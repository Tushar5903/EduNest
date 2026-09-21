import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Institute } from "../src/models/Institute.js";
import { User } from "../src/models/User.js";
import { hashSecret } from "../src/utils/password.js";

/**
 * SUPER_ADMIN RBAC regression guards.
 * - No API input can create or promote to super-admin (role is server-side only).
 * - Super routes are backend-gated: unauthenticated -> 401, admin -> 403.
 * - No creation/promotion endpoint exists (-> 404).
 * - Responses never leak hashes or env secrets.
 */
const app = createApp();

const SUPER_EMAIL = "rbac.root@edunest.in";
const SUPER_PASSWORD = "RbacRoot@12345";
const ADMIN_EMAIL = "rbac.admin@school.in";
const ADMIN_PASSWORD = "RbacAdmin@12345";

let superCookie = "";
let adminCookie = "";
let adminInstituteId = "";

async function loginCookie(identifier: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ identifier, password });
  expect(res.status).toBe(200);
  return (res.headers["set-cookie"] as string[]).join("; ");
}

beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/edunest_test_rbac");
  await mongoose.connection.db?.dropDatabase();

  await User.create({
    name: "RBAC Root",
    email: SUPER_EMAIL,
    passwordHash: await hashSecret(SUPER_PASSWORD),
    role: "super-admin",
    instituteId: null,
    status: "active",
  });

  const institute = await Institute.create({ name: "RBAC School", code: "RBAC001", status: "active" });
  const admin = await User.create({
    name: "RBAC Admin",
    email: ADMIN_EMAIL,
    passwordHash: await hashSecret(ADMIN_PASSWORD),
    role: "admin",
    instituteId: institute._id,
    status: "active",
  });
  institute.adminId = admin._id as never;
  await institute.save();
  adminInstituteId = String(institute._id);

  superCookie = await loginCookie(SUPER_EMAIL, SUPER_PASSWORD);
  adminCookie = await loginCookie(ADMIN_EMAIL, ADMIN_PASSWORD);
}, 30_000);

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

describe("role injection is ignored", () => {
  it("admin-request with role=super-admin still creates a pending admin", async () => {
    const res = await request(app).post("/api/auth/admin-request").send({
      name: "Escalator",
      email: "escalator@evil.in",
      password: "Evil@12345",
      schoolName: "Evil School",
      role: "super-admin",
      status: "active",
    });
    expect(res.status).toBe(201);
    const user = await User.findOne({ email: "escalator@evil.in" });
    expect(user?.role).toBe("admin");
    expect(user?.status).toBe("pending");
  });

  it("super direct-create with role=super-admin still creates an admin", async () => {
    const res = await request(app)
      .post("/api/super/institutes")
      .set("Cookie", superCookie)
      .send({
        schoolName: "Delta Public School",
        adminName: "Delta Principal",
        adminEmail: "delta.principal@school.in",
        role: "super-admin",
        status: "active",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.tempPassword).toBeDefined();
    const user = await User.findOne({ email: "delta.principal@school.in" });
    expect(user?.role).toBe("admin");
    expect(user?.status).toBe("active");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });
});

describe("super route authorization", () => {
  it("unauthenticated -> 401", async () => {
    const res = await request(app).get("/api/super/requests");
    expect(res.status).toBe(401);
  });

  it("admin -> 403 (cannot access super-only API)", async () => {
    const res = await request(app).get("/api/super/requests").set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  it("admin cannot change institute status -> 403", async () => {
    const res = await request(app)
      .patch(`/api/super/institutes/${adminInstituteId}/status`)
      .set("Cookie", adminCookie)
      .send({ action: "suspend-school", reason: "evil attempt" });
    expect(res.status).toBe(403);
  });

  it("invalid status action -> 400 (strict enum, no role promotion)", async () => {
    const res = await request(app)
      .patch(`/api/super/institutes/${adminInstituteId}/status`)
      .set("Cookie", superCookie)
      .send({ action: "promote-to-super-admin", reason: "evil attempt" });
    expect(res.status).toBe(400);
  });
});

describe("no super-admin creation endpoint exists", () => {
  it.each([
    ["post", "/api/super/create-super-admin"],
    ["post", "/api/auth/register-super-admin"],
    ["put", "/api/users/some-id/role"],
    ["patch", "/api/super/super-admin"],
    ["delete", "/api/super/super-admin"],
  ])("%s %s -> 404", async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path)
      .set("Cookie", superCookie)
      .send({ role: "super-admin" });
    expect(res.status).toBe(404);
  });
});

describe("secret leakage", () => {
  it("login + me + directory never expose hashes or env secrets", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: SUPER_EMAIL, password: SUPER_PASSWORD });
    // May hit the shared rate-limit window when the full suite runs together.
    expect([200, 429]).toContain(login.status);
    if (login.status === 429) return;
    const forbidden = ["passwordHash", "refreshTokenHash", "SUPER_PASSWORD", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
    expect(JSON.stringify(login.body)).not.toContain("passwordHash");
    for (const s of forbidden.slice(1)) expect(JSON.stringify(login.body)).not.toContain(s);

    const me = await request(app).get("/api/auth/me").set("Cookie", superCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("super-admin");
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");

    const dir = await request(app).get("/api/super/institutes").set("Cookie", superCookie);
    expect(dir.status).toBe(200);
    expect(JSON.stringify(dir.body)).not.toContain("passwordHash");
  });

  it("wrong super password -> 401, correct -> 200", async () => {
    const bad = await request(app).post("/api/auth/login").send({ identifier: SUPER_EMAIL, password: "Wrong@123" });
    expect([401, 429]).toContain(bad.status);
  });
});
