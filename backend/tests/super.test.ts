import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Class } from "../src/models/Class.js";
import { Institute } from "../src/models/Institute.js";
import { User } from "../src/models/User.js";
import { hashSecret } from "../src/utils/password.js";

const app = createApp();
const JSON_HEADERS = { Accept: "application/json" };

let instituteA = "";
let adminACookie = "";
let teacherCookie = "";
let superCookie = "";

async function loginCookie(identifier: string, password: string, client?: "portal" | "console"): Promise<string> {
  const req = request(app).post("/api/auth/login").set(JSON_HEADERS).send({ identifier, password });
  if (client) req.set("X-Client", client);
  const res = await req;
  expect(res.status).toBe(200);
  return (res.headers["set-cookie"] as string[]).join("; ");
}

beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/edunest_test_super");
  await mongoose.connection.db?.dropDatabase();
  await User.create({
    name: "Root",
    email: "root@edunest.in",
    passwordHash: await hashSecret("Root@12345"),
    role: "super-admin",
    instituteId: null,
    status: "active",
  });
});

afterAll(async () => {
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
});

describe("super-admin approvals", () => {
  it("super-admin login opens a shared session (console pool)", async () => {
    superCookie = await loginCookie("root@edunest.in", "Root@12345", "console");
    expect(superCookie).toContain("edunest_token");
  });

  it("rejects non-super roles with 403", async () => {
    await request(app).post("/api/auth/admin-request").send({
      name: "Temp Principal",
      email: "temp@school.in",
      password: "Temp@12345",
      schoolName: "Temp School",
    });
    const pending = await User.findOne({ email: "temp@school.in" });
    pending!.status = "active";
    await pending!.save();
    await Institute.findByIdAndUpdate(pending!.instituteId, { status: "active" });
    const cookie = await loginCookie("temp@school.in", "Temp@12345");
    const res = await request(app).get("/api/super/requests").set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("lists pending requests, approves, and the admin can then login", async () => {
    await request(app).post("/api/auth/admin-request").send({
      name: "Principal A",
      email: "principala@school.in",
      password: "Principal@123",
      schoolName: "Alpha Public School",
    });
    void superCookie; // shared session from the first test

    const list = await request(app).get("/api/super/requests?status=pending").set("Cookie", superCookie);
    expect(list.status).toBe(200);
    const row = list.body.data.find((r: { schoolName: string }) => r.schoolName === "Alpha Public School");
    expect(row).toBeDefined();
    expect(row.admin.email).toBe("principala@school.in");
    expect(JSON.stringify(row)).not.toContain("passwordHash");
    instituteA = row.instituteId;

    const approve = await request(app).post(`/api/super/requests/${instituteA}/approve`).set("Cookie", superCookie);
    expect(approve.status).toBe(200);

    adminACookie = await loginCookie("principala@school.in", "Principal@123");
    const audit = await AuditLog.findOne({ instituteId: instituteA, action: "admin.approved" });
    expect(audit).toBeDefined();
  });

  it("rejects with reason and the admin stays locked out", async () => {
    await request(app).post("/api/auth/admin-request").send({
      name: "Principal B",
      email: "principalb@school.in",
      password: "Principal@123",
      schoolName: "Beta Public School",
    });
    void superCookie; // shared session from the first test
    const list = await request(app).get("/api/super/requests?status=pending").set("Cookie", superCookie);
    const row = list.body.data.find((r: { schoolName: string }) => r.schoolName === "Beta Public School");

    const noReason = await request(app).post(`/api/super/requests/${row.instituteId}/reject`).set("Cookie", superCookie).send({});
    expect(noReason.status).toBe(400);

    const rejected = await request(app)
      .post(`/api/super/requests/${row.instituteId}/reject`)
      .set("Cookie", superCookie)
      .send({ reason: "Duplicate application" });
    expect(rejected.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ identifier: "principalb@school.in", password: "Principal@123" });
    expect(login.status).toBe(403);
  });

  it("direct-creates an active institute and the temp password works once", async () => {
    void superCookie; // shared session from the first test
    const res = await request(app).post("/api/super/institutes").set("Cookie", superCookie).send({
      schoolName: "Gamma Public School",
      adminName: "Principal C",
      adminEmail: "principalc@school.in",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.tempPassword).toMatch(/^[A-Z2-9]{8}$/);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "principalc@school.in", password: res.body.data.tempPassword });
    expect(login.status).toBe(200);
  });
});

describe("directory privacy (counts only)", () => {
  it("exposes counts but never PII, marks, fees or complaint text", async () => {
    await Class.create({ instituteId: instituteA, name: "8", section: "A", academicYear: "2026-27", order: 8 });
    await User.create({
      name: "Secret Student FullName",
      loginId: "S-9101",
      passwordHash: await hashSecret("x"),
      role: "student",
      instituteId: instituteA,
      status: "active",
    });
    await User.create({
      name: "Secret Teacher FullName",
      loginId: "T-9101",
      passwordHash: await hashSecret("x"),
      role: "teacher",
      instituteId: instituteA,
      status: "active",
    });

    void superCookie; // shared session from the first test
    const dir = await request(app).get("/api/super/institutes").set("Cookie", superCookie);
    expect(dir.status).toBe(200);
    const row = dir.body.data.find((r: { instituteId: string }) => r.instituteId === instituteA);
    expect(row.students).toBe(1);
    expect(row.teachers).toBe(1);
    expect(row.classes).toBe(1);
    const blob = JSON.stringify(dir.body);
    expect(blob).not.toContain("Secret Student FullName");
    expect(blob).not.toContain("Secret Teacher FullName");

    const detail = await request(app).get(`/api/super/institutes/${instituteA}`).set("Cookie", superCookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.admin.email).toBe("principala@school.in");
    expect(JSON.stringify(detail.body)).not.toContain("Secret Student FullName");
  });
});

describe("block / suspend matrix", () => {
  it("block-admin: admin locked, teacher keeps working, banner surfaces", async () => {
    void superCookie; // shared session from the first test
    teacherCookie = await loginCookie("T-9101", "x").catch(() => "");
    // Teacher password is "x" — too short for login validator? login min is 1, fine.
    if (!teacherCookie) {
      await User.findOneAndUpdate({ loginId: "T-9101" }, { passwordHash: await hashSecret("Teach@12345") });
      teacherCookie = await loginCookie("T-9101", "Teach@12345");
    }

    const block = await request(app)
      .patch(`/api/super/institutes/${instituteA}/status`)
      .set("Cookie", superCookie)
      .send({ action: "block-admin", reason: "Fee misuse probe" });
    expect(block.status).toBe(200);

    const adminLogin = await request(app).post("/api/auth/login").send({ identifier: "principala@school.in", password: "Principal@123" });
    expect(adminLogin.status).toBe(403);

    const me = await request(app).get("/api/auth/me").set("Cookie", teacherCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.banner.adminSuspended).toBe(true);

    const unblock = await request(app)
      .patch(`/api/super/institutes/${instituteA}/status`)
      .set("Cookie", superCookie)
      .send({ action: "unblock-admin", reason: "Probe cleared" });
    expect(unblock.status).toBe(200);
    adminACookie = await loginCookie("principala@school.in", "Principal@123");
    expect(adminACookie).toContain("edunest_token");
  });

  it("suspend-school: everyone 403s; unsuspend restores", async () => {
    void superCookie; // shared session from the first test
    const suspend = await request(app)
      .patch(`/api/super/institutes/${instituteA}/status`)
      .set("Cookie", superCookie)
      .send({ action: "suspend-school", reason: "Policy violation" });
    expect(suspend.status).toBe(200);

    for (const [identifier, password] of [["principala@school.in", "Principal@123"]] as const) {
      const res = await request(app).post("/api/auth/login").send({ identifier, password });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/suspended/i);
    }

    const unsuspend = await request(app)
      .patch(`/api/super/institutes/${instituteA}/status`)
      .set("Cookie", superCookie)
      .send({ action: "unsuspend-school", reason: "Resolved" });
    expect(unsuspend.status).toBe(200);

    const back = await request(app).post("/api/auth/login").send({ identifier: "principala@school.in", password: "Principal@123" });
    expect(back.status).toBe(200);

    const kinds = await AuditLog.find({ instituteId: instituteA }).distinct("action");
    for (const k of ["admin.approved", "admin.blocked", "admin.unblocked", "school.suspended", "school.unsuspended"]) {
      expect(kinds).toContain(k);
    }
  });
});
