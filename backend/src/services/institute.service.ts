import { Types } from "mongoose";
import { z } from "zod";
import { AuditLog } from "../models/AuditLog.js";
import { Class } from "../models/Class.js";
import { Institute } from "../models/Institute.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { generateReferenceId } from "../utils/idGenerator.js";
import { hashSecret } from "../utils/password.js";

function assertObjectId(id: string, label = "Institute"): void {
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest("Invalid id format");
}

/** Escape user input before building RegExp — prevents ReDoS / 500 on `***(` etc. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REQUEST_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

async function buildDirectoryRow(i: {
  _id: unknown;
  name: string;
  code: string;
  status: string;
  createdAt: Date;
  adminId: unknown;
}): Promise<DirectoryRow> {
  const [students, teachers, classes, admin] = await Promise.all([
    User.countDocuments({ instituteId: i._id, role: "student", active: true }),
    User.countDocuments({ instituteId: i._id, role: "teacher", active: true }),
    Class.countDocuments({ instituteId: i._id, active: true }),
    User.findOne({ _id: i.adminId }).select("name email status").lean(),
  ]);
  return {
    instituteId: String(i._id),
    schoolName: i.name,
    code: i.code,
    admin: admin ? { name: admin.name, email: admin.email, status: admin.status } : null,
    students,
    teachers,
    classes,
    feesCollectedPercent: 0,
    complaintCounts: { open: 0, total: 0 },
    status: i.status,
    createdAt: i.createdAt,
  };
}

export const directCreateValidator = z.object({
  schoolName: z.string().trim().min(2),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().trim().toLowerCase().email(),
});

export const rejectValidator = z.object({
  reason: z.string().trim().min(3, "Rejection reason is required"),
});

export const instituteStatusValidator = z.object({
  action: z.enum(["block-admin", "unblock-admin", "suspend-school", "unsuspend-school"]),
  reason: z.string().trim().min(3, "Reason is required for audit"),
});

/**
 * Admin-request queue: institute request + requesting admin profile only.
 * `status` filters by the ADMIN's request state (pending/active/rejected...).
 * Rejected requests keep `institute.status=pending` (record preserved) so we
 * must filter on the admin row — otherwise rejected schools haunt `?status=pending`.
 */
export async function listRequests(status: string) {
  const wanted = (status || "pending").trim().toLowerCase();
  if (!(REQUEST_STATUSES as readonly string[]).includes(wanted)) {
    throw ApiError.badRequest("Invalid status filter. Use pending|active|suspended|rejected");
  }
  // Rejected requests are stored as institute=pending + admin=rejected, so a
  // `status=rejected` query must scan pending institutes, not `status=rejected`.
  const instituteFilter: Record<string, unknown> =
    wanted === "rejected" ? { status: "pending" } : { status: wanted };
  const institutes = await Institute.find(instituteFilter).sort({ createdAt: 1 }).lean();
  const adminIds = institutes.map((i) => i.adminId);
  const admins = await User.find({ _id: { $in: adminIds } })
    .select("name email status createdAt instituteId")
    .lean();
  const byInstitute = new Map(admins.map((a) => [String(a.instituteId), a]));
  const rows = institutes.map((i) => ({
    instituteId: String(i._id),
    schoolName: i.name,
    code: i.code,
    address: i.address,
    phone: i.phone,
    status: i.status,
    requestedAt: i.createdAt,
    admin: byInstitute.get(String(i._id))
      ? {
          name: byInstitute.get(String(i._id))!.name,
          email: byInstitute.get(String(i._id))!.email,
          status: byInstitute.get(String(i._id))!.status,
        }
      : null,
  }));
  // Filter by the admin's actual request state so pending never leaks rejected rows.
  return rows.filter((r) => (r.admin ? r.admin.status === wanted : r.status === wanted));
}

function instituteCodeFromName(schoolName: string): string {
  const letters = schoolName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4).padEnd(3, "X");
  return `${letters}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** Approve: activates institute + admin together. Idempotent. */
export async function approveRequest(instituteId: string, superAdminId: string) {
  assertObjectId(instituteId);
  const institute = await Institute.findById(instituteId);
  if (!institute) throw ApiError.notFound("Institute request not found");
  const existingAdmin = await User.findOne({ _id: institute.adminId, role: "admin" }).select("status");
  if (!existingAdmin) throw ApiError.notFound("Requesting admin not found");
  if (institute.status === "active" && existingAdmin.status === "active") {
    return { instituteId: String(institute._id), status: "active" as const };
  }

  institute.status = "active";
  await institute.save();
  const admin = await User.findOneAndUpdate(
    { _id: institute.adminId, role: "admin" },
    { status: "active", approvedBy: superAdminId, approvedAt: new Date(), $unset: { rejectReason: 1 } },
    { new: true },
  );
  if (!admin) throw ApiError.notFound("Requesting admin not found");

  await AuditLog.create({ by: superAdminId, instituteId: institute._id, action: "admin.approved" });
  return { instituteId: String(institute._id), status: "active" as const };
}

export async function rejectRequest(instituteId: string, superAdminId: string, reason: string) {
  assertObjectId(instituteId);
  const institute = await Institute.findById(instituteId);
  if (!institute) throw ApiError.notFound("Institute request not found");
  if (institute.status !== "pending") throw ApiError.badRequest("Only pending requests can be rejected");
  const admin = await User.findOne({ _id: institute.adminId, role: "admin" }).select("status");
  if (!admin) throw ApiError.notFound("Requesting admin not found");
  if (admin.status === "rejected") throw ApiError.badRequest("Request already rejected");
  if (admin.status === "active") throw ApiError.badRequest("Request already approved — use block-admin instead");

  // stays pending-record; admin is the rejected party
  await User.findOneAndUpdate(
    { _id: institute.adminId, role: "admin" },
    { status: "rejected", rejectReason: reason },
  );
  await AuditLog.create({ by: superAdminId, instituteId: institute._id, action: "admin.rejected", reason });
  return { instituteId: String(institute._id), status: "rejected" as const };
}

/**
 * Offline onboarding: super-admin creates an ACTIVE institute + admin.
 * Temp password returned ONCE — never stored or re-readable.
 */
export async function createInstituteDirect(input: z.infer<typeof directCreateValidator>, superAdminId: string) {
  const existing = await User.findOne({ email: input.adminEmail });
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
    status: "active",
  });

  const tempPassword = generateReferenceId();
  const admin = await User.create({
    name: input.adminName.trim(),
    email: input.adminEmail,
    passwordHash: await hashSecret(tempPassword),
    role: "admin",
    instituteId: institute._id,
    status: "active",
    approvedBy: superAdminId,
    approvedAt: new Date(),
  });
  institute.adminId = admin._id as never;
  await institute.save();

  await AuditLog.create({ by: superAdminId, instituteId: institute._id, action: "institute.created" });
  return { instituteId: String(institute._id), adminEmail: admin.email, tempPassword };
}

export interface DirectoryRow {
  instituteId: string;
  schoolName: string;
  code: string;
  admin: { name: string; email?: string; status: string } | null;
  students: number;
  teachers: number;
  classes: number;
  feesCollectedPercent: number; // wired in Phase 7 (Fee model)
  complaintCounts: { open: number; total: number }; // wired in Phase 8 (Complaint model)
  status: string;
  createdAt: Date;
}

/**
 * Counts-only directory. Uses countDocuments exclusively — student/teacher names,
 * marks, fee rows and complaint text can never leak through this endpoint.
 */
export async function instituteDirectory(search?: string, status?: string): Promise<DirectoryRow[]> {
  const filter: Record<string, unknown> = {};
  if (status) {
    const s = status.trim().toLowerCase();
    if (!["pending", "active", "suspended"].includes(s)) {
      throw ApiError.badRequest("Invalid status filter. Use pending|active|suspended");
    }
    filter.status = s;
  }
  const q = (search ?? "").trim();
  if (q) {
    const safe = escapeRegExp(q);
    filter.$or = [{ name: new RegExp(safe, "i") }, { code: new RegExp(escapeRegExp(q.toUpperCase()), "i") }];
  }

  const institutes = await Institute.find(filter).sort({ createdAt: -1 }).lean();
  const rows: DirectoryRow[] = [];
  for (const i of institutes) {
    rows.push(await buildDirectoryRow(i as Parameters<typeof buildDirectoryRow>[0]));
  }
  return rows;
}

export async function instituteDetail(instituteId: string): Promise<DirectoryRow> {
  assertObjectId(instituteId);
  const institute = await Institute.findById(instituteId).lean();
  if (!institute) throw ApiError.notFound("Institute not found");
  return buildDirectoryRow(institute as Parameters<typeof buildDirectoryRow>[0]);
}

export type InstituteStatusAction = z.infer<typeof instituteStatusValidator>["action"];

/**
 * block-admin (default): suspends ONLY the admin — school keeps running,
 * teacher/student logins continue, portal shows a banner.
 * suspend-school (emergency): whole institute suspended — every login 403s.
 */
export async function setInstituteStatus(
  instituteId: string,
  action: InstituteStatusAction,
  reason: string,
  superAdminId: string,
) {
  assertObjectId(instituteId);
  const institute = await Institute.findById(instituteId);
  if (!institute) throw ApiError.notFound("Institute not found");

  let auditAction: "admin.blocked" | "admin.unblocked" | "school.suspended" | "school.unsuspended";
  if (action === "block-admin" || action === "unblock-admin") {
    const admin = await User.findOne({ _id: institute.adminId, role: "admin" });
    if (!admin) throw ApiError.notFound("Institute admin not found");
    admin.status = action === "block-admin" ? "suspended" : "active";
    await admin.save();
    auditAction = action === "block-admin" ? "admin.blocked" : "admin.unblocked";
  } else {
    institute.status = action === "suspend-school" ? "suspended" : "active";
    await institute.save();
    auditAction = action === "suspend-school" ? "school.suspended" : "school.unsuspended";
  }

  await AuditLog.create({ by: superAdminId, instituteId: institute._id, action: auditAction, reason });
  return { instituteId: String(institute._id), action };
}
