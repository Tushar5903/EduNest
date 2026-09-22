import { createHash, timingSafeEqual } from "node:crypto";
import { Institute } from "../models/Institute.js";
import { User, type UserDoc } from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { normalizePhone } from "../utils/phone.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { hashSecret, verifySecret } from "../utils/password.js";

/**
 * Sentinel subject for the environment-backed Super Admin.
 * It is NOT a MongoDB ObjectId and MUST NOT match any users._id —
 * the Super Admin has no record in the users collection by design.
 */
export const SUPER_ADMIN_ID = "super-admin";

function isEnvSuperAdminIdentifier(identifier: string): boolean {
  return identifier.trim().toLowerCase() === env.SUPER_EMAIL.toLowerCase();
}

/** Length-leak-free comparison: sha256 both sides, then constant-time compare. */
function verifyEnvSecret(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Public profile for the environment-backed Super Admin. Never carries email/secrets. */
export function superAdminUser(): PublicUser {
  return {
    id: SUPER_ADMIN_ID,
    name: "Super Admin",
    role: "super-admin",
    instituteId: null,
    classId: null,
    status: "active",
  };
}

function superAdminSession(): LoginResult {
  const accessToken = signAccessToken({ sub: SUPER_ADMIN_ID, role: "super-admin", instituteId: null });
  const refreshToken = signRefreshToken(SUPER_ADMIN_ID);
  return { user: superAdminUser(), accessToken, refreshToken };
}

export interface PublicUser {
  id: string;
  name: string;
  email?: string;
  loginId?: string;
  role: UserDoc["role"];
  instituteId: string | null;
  classId: string | null;
  rollNo?: number;
  status: UserDoc["status"];
}

export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    loginId: user.loginId,
    role: user.role,
    instituteId: user.instituteId ? String(user.instituteId) : null,
    classId: user.classId ? String(user.classId) : null,
    rollNo: user.rollNo,
    status: user.status,
  };
}

function instituteCodeFromName(schoolName: string): string {
  const letters = schoolName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4).padEnd(3, "X");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${letters}${suffix}`;
}

export interface AdminRequestInput {
  name: string;
  email: string;
  password: string;
  schoolName: string;
  address?: string;
  phone?: string;
}

/**
 * School admin self-registration. Creates a PENDING institute + PENDING admin.
 * No login is possible until super-admin approves (see institute.service, Phase 3).
 */
export async function requestAdminAccess(input: AdminRequestInput): Promise<{ instituteId: string }> {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  let code = instituteCodeFromName(input.schoolName);
  for (let i = 0; i < 3 && (await Institute.findOne({ code })); i++) {
    code = instituteCodeFromName(input.schoolName);
  }

  const institute = await Institute.create({
    name: input.schoolName.trim(),
    code,
    address: input.address,
    phone: input.phone,
    status: "pending",
  });

  const admin = await User.create({
    name: input.name.trim(),
    email,
    passwordHash: await hashSecret(input.password),
    role: "admin",
    instituteId: institute._id,
    status: "pending",
  });

  institute.adminId = admin._id as never;
  await institute.save();

  return { instituteId: String(institute._id) };
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Identifier login. Every identifier resolves to exactly one account:
 * - email (admin/super-admin) — contains "@"
 * - 6-digit loginId (student) — /^\d{6}$/
 * - 10–15 digit phone (teacher alias, unique among active teachers)
 * - anything else — loginId as before (T-XXXX keeps working)
 * Portal vs console field separation is UX; the backend accepts all forms and
 * RBAC gates every endpoint afterwards.
 */
export async function login(identifier: string, password: string): Promise<LoginResult> {
  // Environment-backed Super Admin takes precedence over the database.
  // No users-collection record is required; credentials never leave the backend.
  if (isEnvSuperAdminIdentifier(identifier)) {
    // Generic message — never reveal whether the email or the password was wrong.
    if (!verifyEnvSecret(password, env.SUPER_PASSWORD)) throw ApiError.unauthorized("Invalid credentials");
    return superAdminSession();
  }

  const id = identifier.trim();
  const digits = normalizePhone(id);
  const query = id.includes("@")
    ? { email: id.toLowerCase() }
    : /^\d{6}$/.test(digits)
      ? { loginId: digits }
      : /^\d{10,15}$/.test(digits)
        ? { phone: digits, role: "teacher", active: true }
        : { loginId: id.toUpperCase() };

  const user = await User.findOne(query).select("+passwordHash +refreshTokenHash");
  // Generic message — never reveal whether the identifier exists.
  if (!user) throw ApiError.unauthorized("Invalid credentials");
  if (!user.active) throw ApiError.unauthorized("Account no longer exists");

  const passwordOk = await verifySecret(password, user.passwordHash);
  if (!passwordOk) throw ApiError.unauthorized("Invalid credentials");

  if (user.status === "pending") throw ApiError.forbidden("Account pending approval");
  if (user.status === "suspended") throw ApiError.forbidden("Account suspended — contact administration");
  if (user.status === "rejected") throw ApiError.forbidden("Access request was rejected");

  if (user.instituteId) {
    const institute = await Institute.findById(user.instituteId).select("status");
    if (!institute) throw ApiError.forbidden("School record not found");
    if (institute.status === "suspended") throw ApiError.forbidden("School suspended — contact super-admin");
    if (institute.status === "pending") throw ApiError.forbidden("School pending approval");
  }

  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    instituteId: user.instituteId ? String(user.instituteId) : null,
  });
  const refreshToken = signRefreshToken(String(user._id));
  user.refreshTokenHash = await hashSecret(refreshToken);
  await user.save();

  return { user: toPublicUser(user), accessToken, refreshToken };
}

/** Rotates the refresh token. Reuse of an old token fails (hash mismatch). */
export async function refreshSession(refreshToken: string): Promise<LoginResult> {
  let sub: string;
  try {
    sub = verifyRefreshToken(refreshToken).sub;
  } catch {
    throw ApiError.unauthorized("Session expired — please login again");
  }
  // Stateless environment-backed Super Admin: signature + kind already verified
  // above, and there is no stored hash to rotate (revoke via JWT_REFRESH_SECRET).
  if (sub === SUPER_ADMIN_ID) return superAdminSession();
  const user = await User.findById(sub).select("+refreshTokenHash");
  if (!user || !user.active || !user.refreshTokenHash) {
    throw ApiError.unauthorized("Session expired — please login again");
  }
  const matches = await verifySecret(refreshToken, user.refreshTokenHash);
  if (!matches) throw ApiError.unauthorized("Session expired — please login again");
  if (user.status !== "active") throw ApiError.forbidden("Account is not active");

  const accessToken = signAccessToken({
    sub: String(user._id),
    role: user.role,
    instituteId: user.instituteId ? String(user.instituteId) : null,
  });
  const nextRefresh = signRefreshToken(String(user._id));
  user.refreshTokenHash = await hashSecret(nextRefresh);
  await user.save();

  return { user: toPublicUser(user), accessToken, refreshToken: nextRefresh };
}

/** Best-effort server-side logout: drops the stored refresh hash. Cookies cleared by controller. */
export async function logout(userId: string | null): Promise<void> {
  if (!userId || userId === SUPER_ADMIN_ID) return;
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

export interface SessionInfo {
  user: PublicUser;
  banner: { adminSuspended: boolean; instituteStatus: string };
}

/**
 * Session hydrate for Next.js (protect only — no status gate, so the frontend
 * can render pending/suspended states and banners instead of getting 403).
 */
export async function getSession(userId: string): Promise<SessionInfo> {
  // Stateless environment-backed Super Admin: no database record by design.
  if (userId === SUPER_ADMIN_ID) {
    return { user: superAdminUser(), banner: { adminSuspended: false, instituteStatus: "none" } };
  }
  const user = await User.findById(userId);
  if (!user || !user.active) throw ApiError.unauthorized("Account no longer exists");

  let instituteStatus = "none";
  let adminSuspended = false;
  if (user.instituteId) {
    // NOTE: adminId must be selected — the banner depends on it.
    const institute = await Institute.findById(user.instituteId).select("status adminId");
    instituteStatus = institute?.status ?? "missing";
    // A blocked admin's school keeps running — surface it as a banner, not a lockout.
    const admin = await User.findOne({ _id: institute?.adminId }).select("status");
    adminSuspended = admin?.status === "suspended";
  }
  return { user: toPublicUser(user), banner: { adminSuspended, instituteStatus } };
}
