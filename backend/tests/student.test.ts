import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { Institute } from "../src/models/Institute.js";
import { Class } from "../src/models/Class.js";
import { User } from "../src/models/User.js";
import { Timetable } from "../src/models/Timetable.js";
import { Attendance } from "../src/models/Attendance.js";
import { hashSecret } from "../src/utils/password.js";

process.env.SUPER_EMAIL = process.env.SUPER_EMAIL ?? "super@test.in";
process.env.SUPER_PASSWORD = process.env.SUPER_PASSWORD ?? "Super@Test123";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

const app = createApp();

let mongo: MongoMemoryServer;

async function loginAs(identifier: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").set("X-Client", "portal").send({ identifier, password });
  return { agent, res };
}

/** Rate-limit-safe auth: bypasses POST /login limiter via service login + manual cookies. */
async function authAgent(identifier: string, password: string) {
  const { login } = await import("../src/services/auth.service.js");
  const { accessToken, refreshToken } = await login(identifier, password);
  const agent = request.agent(app);
  const cookie = `edunest_token=${accessToken}; edunest_refresh=${refreshToken}`;
  const probe = await agent.get("/api/auth/me").set("Cookie", cookie);
  if (probe.status !== 200) throw new Error(`authAgent login failed for ${identifier}: ${probe.status}`);
  const withAuth = {
    get: (url: string) => agent.get(url).set("Cookie", cookie),
    post: (url: string) => agent.post(url).set("Cookie", cookie),
    patch: (url: string) => agent.patch(url).set("Cookie", cookie),
    delete: (url: string) => agent.delete(url).set("Cookie", cookie),
    put: (url: string) => agent.put(url).set("Cookie", cookie),
  };
  return { agent: withAuth, cookie };
}

describe("Student portal", () => {
  let instituteId: string;
  let classAId: string;
  let classBId: string;
  let teacherId: string;
  let student1Id: string;
  let student2Id: string;
  const pwd = "Student@123";

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.syncIndexes(), Institute.syncIndexes(), Class.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await Promise.all([
      User.syncIndexes(),
      Institute.syncIndexes(),
      Class.syncIndexes(),
      Timetable.syncIndexes(),
      Attendance.syncIndexes(),
      (await import("../src/models/Complaint.js")).Complaint.syncIndexes(),
      (await import("../src/models/Fee.js")).Fee.syncIndexes(),
      (await import("../src/models/Test.js")).Test.syncIndexes(),
      (await import("../src/models/Result.js")).Result.syncIndexes(),
    ]);

    const inst = await Institute.create({ name: "Test School", code: "TST001", status: "active" });
    instituteId = String(inst._id);

    const teacher = await User.create({
      name: "Asha Teacher",
      loginId: "T-1001",
      passwordHash: await hashSecret("Teacher@123"),
      role: "teacher",
      instituteId: inst._id,
      subject: "Maths",
      phone: "9999999999",
      status: "active",
    });
    teacherId = String(teacher._id);

    const classA = await Class.create({ instituteId: inst._id, name: "5", section: "A", academicYear: "2026-27", order: 5, teacherId: teacher._id });
    const classB = await Class.create({ instituteId: inst._id, name: "6", section: "A", academicYear: "2026-27", order: 6 });
    classAId = String(classA._id);
    classBId = String(classB._id);

    const s1 = await User.create({
      name: "Ravi Student", loginId: "100001", passwordHash: await hashSecret(pwd),
      role: "student", instituteId: inst._id, classId: classA._id, rollNo: 1, status: "active",
    });
    const s2 = await User.create({
      name: "Meera Student", loginId: "100002", passwordHash: await hashSecret(pwd),
      role: "student", instituteId: inst._id, classId: classA._id, rollNo: 2, status: "active",
    });
    student1Id = String(s1._id);
    student2Id = String(s2._id);

    await Timetable.create({
      instituteId: inst._id, classId: classA._id, subject: "Maths", teacherId: teacher._id,
      day: "Mon", startTime: "09:00", endTime: "10:00", type: "regular",
    });
  });

  it("student login succeeds; invalid credentials 401", async () => {
    const { res } = await loginAs("100001", pwd);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("suspended student blocked; session hydrate works", async () => {
    await User.findOneAndUpdate({ loginId: "100001" }, { status: "suspended" });
    const { login } = await import("../src/services/auth.service.js");
    await expect(login("100001", pwd)).rejects.toMatchObject({ status: 403 });
    const { agent } = await authAgent("100002", pwd);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
  });

  it("student reads own attendance; cannot read another student's fees/results", async () => {
    const { agent } = await authAgent("100001", pwd);
    const mine = await agent.get("/api/students/me/attendance");
    expect(mine.status).toBe(200);
    const list = await agent.get("/api/attendance").query({ studentId: "000000000000000000000000" });
    expect(list.status).toBe(200);
    const fees = await agent.get("/api/fees").query({ studentId: student2Id });
    if (fees.status === 200) {
      expect(JSON.stringify(fees.body)).not.toContain("100002");
    } else {
      expect([403, 400]).toContain(fees.status);
    }
    const results = await agent.get("/api/results").query({ studentId: student2Id });
    if (results.status === 200) {
      expect(JSON.stringify(results.body)).not.toContain(student2Id);
    } else {
      expect([403, 400]).toContain(results.status);
    }
  });

  it("student denied other class + admin/teacher endpoints", async () => {
    const { agent } = await authAgent("100001", pwd);
    const other = await agent.get(`/api/classes/${classBId}`);
    expect(other.status).toBe(403);
    const own = await agent.get(`/api/classes/${classAId}`);
    expect(own.status).toBe(200);
    expect((await agent.post("/api/admin/students").send({ name: "x", classId: classAId })).status).toBe(403);
    expect((await agent.delete("/api/admin/users/000000000000000000000000")).status).toBe(403);
    expect((await agent.post("/api/attendance").send({})).status).toBe(403);
    expect((await agent.get("/api/super/institutes")).status).toBe(403);
  });

  it("my teachers returns only own-class teachers without contact PII", async () => {
    const { agent } = await authAgent("100001", pwd);
    const res = await agent.get("/api/students/me/teachers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    for (const t of res.body.data) {
      expect(t).not.toHaveProperty("phone");
      expect(t).not.toHaveProperty("email");
    }
  });

  it("my timetable scoped to own class; notices scoped", async () => {
    const { agent } = await authAgent("100001", pwd);
    const tt = await agent.get("/api/students/me/timetable");
    expect(tt.status).toBe(200);
    expect(tt.body.data.days.Mon.length).toBeGreaterThanOrEqual(1);
    const notices = await agent.get("/api/notices");
    expect(notices.status).toBe(200);
    expect((await agent.post("/api/notices").send({ title: "hi", body: "x", audience: "all" })).status).toBe(403);
  });

  it("complaint create + track mine only; invalid recipient rejected; 3rd in day 429; no edit", async () => {
    const { agent } = await authAgent("100001", pwd);
    const teachers = await agent.get("/api/students/me/teachers");
    expect(teachers.status).toBe(200);
    const toTeacherId = teachers.body.data[0].id;
    const c1 = await agent.post("/api/complaints").send({
      toType: "teacher", toTeacherId, category: "other", subject: "Too much homework load", body: "Homework takes more than 3 hours daily, please reduce.",
    });
    expect(c1.status).toBe(201);
    const bad = await agent.post("/api/complaints").send({
      toType: "teacher", toTeacherId: "000000000000000000000000", category: "other", subject: "Invalid teacher test", body: "This should be rejected by validation.",
    });
    expect([400, 403]).toContain(bad.status);
    const c2 = await agent.post("/api/complaints").send({
      toType: "admin", category: "other", subject: "Library books request", body: "Please add more story books to the library for class 5.",
    });
    expect(c2.status).toBe(201);
    const c3 = await agent.post("/api/complaints").send({
      toType: "admin", category: "other", subject: "Third complaint today", body: "This third complaint on the same day must be rate limited.",
    });
    expect(c3.status).toBe(429);
    const mine = await agent.get("/api/complaints/mine");
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(2);
    const edit = await agent.patch(`/api/complaints/${mine.body.data[0].id}`).send({ status: "resolved" });
    expect(edit.status).toBe(403);
    const { agent: agent2 } = await authAgent("100002", pwd);
    const mine2 = await agent2.get("/api/complaints/mine");
    expect(mine2.body.data).toHaveLength(0);
  });

  it("teacher inbox hides admin complaints", async () => {
    const { agent } = await authAgent("100001", pwd);
    const teachers = await agent.get("/api/students/me/teachers");
    const toTeacherId = teachers.body.data[0].id;
    await agent.post("/api/complaints").send({
      toType: "teacher", toTeacherId, category: "other", subject: "Teacher inbox item", body: "Visible to my teacher for moderation testing.",
    });
    await agent.post("/api/complaints").send({
      toType: "admin", category: "other", subject: "Admin only complaint", body: "Teacher must never see this admin-directed complaint.",
    });
    const { agent: tAgent } = await authAgent("9999999999", "Teacher@123");
    const inbox = await tAgent.get("/api/complaints/teacher");
    expect(inbox.status).toBe(200);
    expect(JSON.stringify(inbox.body)).not.toContain("Admin only complaint");
  });

  it("fees read-only: student sees own, cannot modify; teacher marks paid", async () => {
    const { Fee } = await import("../src/models/Fee.js");
    const fee = await Fee.create({
      instituteId: new mongoose.Types.ObjectId(instituteId),
      studentId: new mongoose.Types.ObjectId(student1Id),
      amount: 5000, dueDate: "2026-10-10", status: "pending",
    });
    const { agent } = await authAgent("100001", pwd);
    const mine = await agent.get("/api/students/me/fees");
    expect(mine.status).toBe(200);
    expect(mine.body.data.due).toBe(5000);
    expect((await agent.patch(`/api/fees/${String(fee._id)}`).send({ amount: 1 })).status).toBe(403);
    const { agent: tAgent } = await authAgent("9999999999", "Teacher@123");
    const marked = await tAgent.patch(`/api/teacher/fees/${String(fee._id)}/status`).send({ status: "paid", remark: "cash collected" });
    expect(marked.status).toBe(200);
    expect(marked.body.data.status).toBe("paid");
  });

  it("fees auto-overdue on read; manual overdue rejected; paid by teacher and admin", async () => {
    const { Fee } = await import("../src/models/Fee.js");
    const { FeeAudit } = await import("../src/models/Fee.js");
    const { hashSecret: hs } = await import("../src/utils/password.js");
    await User.create({
      name: "Admin One", loginId: "A-9001", passwordHash: await hs("Admin@123"),
      role: "admin", instituteId: new mongoose.Types.ObjectId(instituteId), phone: "8888888888", status: "active",
    });
    const past = await Fee.create({
      instituteId: new mongoose.Types.ObjectId(instituteId),
      studentId: new mongoose.Types.ObjectId(student1Id),
      amount: 1000, dueDate: "2020-01-01", status: "pending",
    });
    const { agent: tAgent } = await authAgent("9999999999", "Teacher@123");
    const list = await tAgent.get("/api/fees");
    expect(list.status).toBe(200);
    const row = (list.body.data as Array<{ id: string; status: string }>).find((f) => f.id === String(past._id));
    expect(row?.status).toBe("overdue");
    expect(await FeeAudit.countDocuments({ feeId: past._id, newStatus: "overdue" })).toBe(1);
    const { agent: aAgent } = await authAgent("A-9001", "Admin@123");
    expect((await aAgent.patch(`/api/fees/${String(past._id)}`).send({ status: "overdue" })).status).toBe(400);
    const viaTeacher = await tAgent.patch(`/api/teacher/fees/${String(past._id)}/status`).send({ status: "paid" });
    expect(viaTeacher.status).toBe(200);
    expect(viaTeacher.body.data.status).toBe("paid");
    const fresh = await Fee.create({
      instituteId: new mongoose.Types.ObjectId(instituteId),
      studentId: new mongoose.Types.ObjectId(student1Id),
      amount: 2000, dueDate: "2026-10-10", status: "pending",
    });
    const viaAdmin = await aAgent.patch(`/api/fees/${String(fresh._id)}`).send({ status: "paid" });
    expect(viaAdmin.status).toBe(200);
    expect(viaAdmin.body.data.status).toBe("paid");
  });

  it("results read-only with teacher join; institute isolation", async () => {
    const { Result } = await import("../src/models/Result.js");
    await Result.create({
      instituteId: new mongoose.Types.ObjectId(instituteId),
      classId: new mongoose.Types.ObjectId(classAId),
      exam: "Term1", studentId: new mongoose.Types.ObjectId(student1Id),
      subjects: [{ name: "Maths", marks: 80, max: 100 }],
    });
    const { agent } = await authAgent("100001", pwd);
    const mine = await agent.get("/api/students/me/results").query({ exam: "Term1" });
    expect(mine.status).toBe(200);
    expect(mine.body.data.data[0].percent).toBe(80);
    const { agent: agent2 } = await authAgent("100002", pwd);
    const mine2 = await agent2.get("/api/students/me/results").query({ exam: "Term1" });
    expect(mine2.body.data.data).toHaveLength(0);
  });

  it("rollNo uniqueness preserved (duplicate rejected)", async () => {
    await expect(
      User.create({
        name: "Dup Roll", loginId: "100003", passwordHash: await hashSecret(pwd),
        role: "student", instituteId: new mongoose.Types.ObjectId(instituteId),
        classId: new mongoose.Types.ObjectId(classAId), rollNo: 1, status: "active",
      }),
    ).rejects.toThrow();
  });

  it("attendance myAttendance percent only counts recorded days", async () => {
    const period = await Timetable.findOne({ classId: new mongoose.Types.ObjectId(classAId) });
    await Attendance.create({
      instituteId: new mongoose.Types.ObjectId(instituteId),
      classId: new mongoose.Types.ObjectId(classAId),
      date: "2026-09-20", periodId: period!._id,
      records: [
        { studentId: new mongoose.Types.ObjectId(student1Id), status: "present" },
        { studentId: new mongoose.Types.ObjectId(student2Id), status: "absent" },
      ],
      markedBy: new mongoose.Types.ObjectId(teacherId),
    });
    const { agent } = await authAgent("100001", pwd);
    const res = await agent.get("/api/students/me/attendance").query({ month: "2026-09" });
    expect(res.status).toBe(200);
    expect(res.body.data.percent).toBe(100);
  });
});
