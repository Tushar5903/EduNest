import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { Institute } from "../src/models/Institute.js";
import { User } from "../src/models/User.js";
import { hashSecret } from "../src/utils/password.js";

process.env.SUPER_EMAIL = process.env.SUPER_EMAIL ?? "super@test.in";
process.env.SUPER_PASSWORD = process.env.SUPER_PASSWORD ?? "Super@Test123";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

const app = createApp();

let mongo: MongoMemoryServer;

/** Rate-limit-safe auth: bypasses POST /login limiter via service login + manual cookies. */
async function authAgent(identifier: string, password: string) {
  const { login } = await import("../src/services/auth.service.js");
  const { accessToken, refreshToken } = await login(identifier, password);
  const agent = request.agent(app);
  const cookie = `edunest_token=${accessToken}; edunest_refresh=${refreshToken}`;
  return {
    get: (url: string) => agent.get(url).set("Cookie", cookie),
  };
}

describe("Audit logs (super-admin feed)", () => {
  let instituteId: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.syncIndexes(), Institute.syncIndexes(), AuditLog.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await Promise.all([User.syncIndexes(), Institute.syncIndexes(), AuditLog.syncIndexes()]);

    const inst = await Institute.create({ name: "Audit School", code: "AUD001", status: "active" });
    instituteId = String(inst._id);

    await User.create({
      name: "Audit Admin",
      email: "audit.admin@test.in",
      passwordHash: await hashSecret("Admin@123"),
      role: "admin",
      instituteId: inst._id,
      status: "active",
    });

    await AuditLog.create({ by: "super-admin", instituteId: inst._id, action: "admin.approved", reason: "looks good" });
    await AuditLog.create({ by: "super-admin", instituteId: inst._id, action: "school.suspended", reason: "fees fraud" });
  });

  it("super-admin lists events as plain array matching frontend contract", async () => {
    const superAgent = await authAgent(process.env.SUPER_EMAIL!, process.env.SUPER_PASSWORD!);
    const res = await superAgent.get("/api/audit-logs");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    // Newest first.
    expect(res.body.data[0].action).toBe("school.suspended");
    const first = res.body.data[0];
    expect(first).toMatchObject({
      action: "school.suspended",
      entityType: "institute",
      entityId: instituteId,
      severity: "CRITICAL",
    });
    expect(typeof first.id).toBe("string");
    expect(typeof first.timestamp).toBe("string");
    expect(typeof first.actor).toBe("string");
  });

  it("filters by action + search, and serves stats", async () => {
    const superAgent = await authAgent(process.env.SUPER_EMAIL!, process.env.SUPER_PASSWORD!);
    const filtered = await superAgent.get("/api/audit-logs").query({ action: "admin.approved" });
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.length).toBe(1);

    const searched = await superAgent.get("/api/audit-logs").query({ search: "fraud" });
    expect(searched.status).toBe(200);
    expect(searched.body.data.length).toBe(1);
    expect(searched.body.data[0].action).toBe("school.suspended");

    const stats = await superAgent.get("/api/audit-logs/stats");
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({ total: 2, criticalSevenDays: 1 });
    expect(typeof stats.body.data.today).toBe("number");
    expect(typeof stats.body.data.activeAdministrators).toBe("number");
  });

  it("admin is forbidden; unauthenticated is 401; bad instituteId is 400", async () => {
    const adminAgent = await authAgent("audit.admin@test.in", "Admin@123");
    expect((await adminAgent.get("/api/audit-logs")).status).toBe(403);
    expect((await adminAgent.get("/api/audit-logs/stats")).status).toBe(403);

    const anon = await request(app).get("/api/audit-logs");
    expect(anon.status).toBe(401);

    const superAgent = await authAgent(process.env.SUPER_EMAIL!, process.env.SUPER_PASSWORD!);
    expect((await superAgent.get("/api/audit-logs").query({ instituteId: "nope" })).status).toBe(400);
  });
});
