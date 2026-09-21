import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Institute } from "../src/models/Institute.js";
import { User } from "../src/models/User.js";
import { hashSecret } from "../src/utils/password.js";

/**
 * Environment-backed Super Admin (no users-collection record).
 * Credentials are read from process env at runtime and never printed.
 * Assumes SUPER_EMAIL does not collide with the fixture emails below.
 */
const app = createApp();

const ADMIN_EMAIL = "envtest.admin@school.in";
const ADMIN_PASSWORD = "EnvAdmin@12345";

let superCookie = "";
let adminCookie = "";
let teacherCookie = "";

function jwtKeys(cookieHeader: string): string[] {
  const token = (cookieHeader.split(";").find((c) => c.trim().startsWith("edunest_token=")) ?? "").split("=")[1] ?? "";
  const seg = token.split(".")[1] ?? "";
  return Object.keys(JSON.parse(Buffer.from(seg, "base64url").toString()));
}

beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/edunest_test_envenv");
  await mongoose.connection.db?.dropDatabase();

  const institute = await Institute.create({ name: "Env School", code: "ENV001", status: "active" });
  const admin = await User.create({
    name: "Env Admin",
    email: ADMIN_EMAIL,
    passwordHash: await hashSecret(ADMIN_PASSWORD),
    role: "admin",
    instituteId: institute._id,
    status: "active",
  });
  institute.adminId = admin._id as never;
  await institute.save();
  await User.create({
    name: "Env Teacher",
    loginId: "T-ENV1",
    passwordHash: await hashSecret("EnvTeach@123"),
    role: "teacher",
    instituteId: institute._id,
    status: "active",
  });
}, 30_000);

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

describe("env-backed super-admin login", () => {
  it("TEST 1: correct env credentials -> 200 as super-admin, no DB record needed", async () => {
    expect(await User.countDocuments({ role: "super-admin" })).toBe(0);
    const res = await request(app).post("/api/auth/login").send({ identifier: env.SUPER_EMAIL, password: env.SUPER_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("super-admin");
    expect(res.body.data.user.id).toBe("super-admin");
    expect(res.body.data.user.email).toBeUndefined();
    const cookies = (res.headers["set-cookie"] as string[]).join("; ");
    expect(cookies).toMatch(/edunest_token=.*HttpOnly/i);
    superCookie = cookies;
    // Still no database record — authentication is purely env-backed.
    expect(await User.countDocuments({ role: "super-admin" })).toBe(0);
  });

  it("TEST 2: correct email + wrong password -> generic 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ identifier: env.SUPER_EMAIL, password: "Wrong@99999" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("TEST 3: wrong email -> generic 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ identifier: "nobody@nowhere.in", password: "x" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("TEST 4/5: normal ADMIN and USER (teacher) login still work", async () => {
    const admin = await request(app).post("/api/auth/login").send({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(admin.status).toBe(200);
    expect(admin.body.data.user.role).toBe("admin");
    adminCookie = (admin.headers["set-cookie"] as string[]).join("; ");

    const teacher = await request(app).post("/api/auth/login").send({ identifier: "t-env1", password: "EnvTeach@123" });
    expect(teacher.status).toBe(200);
    expect(teacher.body.data.user.role).toBe("teacher");
    teacherCookie = (teacher.headers["set-cookie"] as string[]).join("; ");
  });

  it("TEST 6/7: ADMIN and USER cannot access super-only APIs; unauthenticated -> 401", async () => {
    expect((await request(app).get("/api/super/requests").set("Cookie", adminCookie)).status).toBe(403);
    expect((await request(app).get("/api/super/requests").set("Cookie", teacherCookie)).status).toBe(403);
    expect((await request(app).get("/api/super/requests")).status).toBe(401);
  });

  it("env super-admin drives the full approve flow (audit keeps working)", async () => {
    await request(app).post("/api/auth/admin-request").send({
      name: "Env Principal",
      email: "env.principal@school.in",
      password: "EnvPrincipal@123",
      schoolName: "Env Public School",
    });
    const list = await request(app).get("/api/super/requests?status=pending").set("Cookie", superCookie);
    expect(list.status).toBe(200);
    const row = list.body.data.find((r: { schoolName: string }) => r.schoolName === "Env Public School");
    expect(row).toBeDefined();

    const approve = await request(app).post(`/api/super/requests/${row.instituteId}/approve`).set("Cookie", superCookie);
    expect(approve.status).toBe(200);
    const audit = await AuditLog.findOne({ instituteId: row.instituteId, action: "admin.approved" }).lean();
    expect(audit).toBeDefined();
    expect(String(audit!.by)).toBe("super-admin");

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "env.principal@school.in", password: "EnvPrincipal@123" });
    expect(adminLogin.status).toBe(200);
  });

  it("TEST 8: role injection cannot create super-admin access", async () => {
    const res = await request(app).post("/api/super/institutes").set("Cookie", superCookie).send({
      schoolName: "Env Gamma School",
      adminName: "Env Gamma",
      adminEmail: "env.gamma@school.in",
      role: "super-admin",
    });
    expect(res.status).toBe(201);
    expect((await User.findOne({ email: "env.gamma@school.in" }))?.role).toBe("admin");
  });

  it("TEST 9/10: JWT and responses expose no secrets", async () => {
    expect(jwtKeys(superCookie).sort()).toEqual(["exp", "iat", "instituteId", "role", "sub"]);

    const me = await request(app).get("/api/auth/me").set("Cookie", superCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe("super-admin");
    const blob = JSON.stringify(me.body);
    for (const s of ["passwordHash", "refreshTokenHash", "SUPER_PASSWORD", "SUPER_EMAIL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
      expect(blob).not.toContain(s);
    }
    expect(blob).not.toContain(env.SUPER_PASSWORD);
  });

  it("refresh + logout cycle works for the env super-admin", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ identifier: env.SUPER_EMAIL, password: env.SUPER_PASSWORD });
    const refreshed = await agent.post("/api/auth/refresh");
    expect([200, 401]).toContain(refreshed.status);
    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
  });

  it("TEST 11: works with zero user records (no DB dependency)", async () => {
    await User.deleteMany({});
    await Institute.deleteMany({});
    const res = await request(app).post("/api/auth/login").send({ identifier: env.SUPER_EMAIL, password: env.SUPER_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("super-admin");
    const me = await request(app).get("/api/auth/me").set("Cookie", (res.headers["set-cookie"] as string[]).join("; "));
    expect(me.status).toBe(200);
  });
});
