import { Types } from "mongoose";
import { Result } from "../models/Result.js";
import { Test, TestMark } from "../models/Test.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";
import { requireClassInInstitute } from "../utils/scope.js";

async function requireOwnedClassForTeacher(classId: string, teacherId: string, instituteId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (String(klass.teacherId ?? "") !== teacherId) throw ApiError.forbidden("Forbidden for this class");
  return klass;
}

export async function createTest(actor: { id: string; role: string }, instituteId: string, input: { classId: string; subject: string; title: string; date: string; maxMarks: number }) {
  if (actor.role === "teacher") await requireOwnedClassForTeacher(input.classId, actor.id, instituteId);
  else await requireClassInInstitute(input.classId, instituteId);
  const t = await Test.create({
    instituteId: new Types.ObjectId(instituteId),
    classId: new Types.ObjectId(input.classId),
    subject: input.subject.trim(),
    title: input.title.trim(),
    date: input.date,
    maxMarks: input.maxMarks,
    createdBy: new Types.ObjectId(actor.id),
  });
  return { id: String(t._id), title: t.title, subject: t.subject, maxMarks: t.maxMarks };
}

export async function listTests(instituteId: string, query: { classId?: string; subject?: string }, viewer: { role: string; id: string }) {
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };
  if (viewer.role === "student") {
    const me = await User.findById(viewer.id).select("classId classIds");
    const studentClassIds = [me?.classId, ...(Array.isArray(me?.classIds) ? me.classIds : [])].filter(Boolean).map(String);
    if (!studentClassIds.length) return [];
    filter.classId = { $in: studentClassIds.map((id) => new Types.ObjectId(id)) };
  } else if (viewer.role === "teacher") {
    const { Class } = await import("../models/Class.js");
    const owned = await Class.find({ teacherId: new Types.ObjectId(viewer.id), instituteId: new Types.ObjectId(instituteId) }).select("_id");
    const ownedIds = owned.map((c) => String(c._id));
    if (query.classId) {
      if (!ownedIds.includes(query.classId)) throw ApiError.forbidden("Forbidden for this class");
      filter.classId = new Types.ObjectId(query.classId);
    } else {
      filter.classId = { $in: owned.map((c) => c._id) };
    }
  } else if (query.classId) {
    await requireClassInInstitute(query.classId, instituteId);
    filter.classId = new Types.ObjectId(query.classId);
  }
  if (query.subject) filter.subject = new RegExp(`^${query.subject.trim()}$`, "i");
  const rows = await Test.find(filter).sort({ date: -1 }).limit(100).lean();
  return rows.map((t) => ({ id: String(t._id), classId: String(t.classId), subject: t.subject, title: t.title, date: t.date, maxMarks: t.maxMarks }));
}

export async function saveMarks(actor: { id: string; role: string }, instituteId: string, testId: string, marks: { studentId: string; marks: number }[]) {
  assertObjectId(testId);
  const test = await Test.findById(testId);
  if (!test) throw ApiError.notFound("Test not found");
  if (String(test.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (actor.role === "teacher") await requireOwnedClassForTeacher(String(test.classId), actor.id, instituteId);

  for (const m of marks) {
    assertObjectId(m.studentId);
    if (m.marks > test.maxMarks) throw ApiError.badRequest(`marks must not exceed maxMarks ${test.maxMarks}`);
    const s = await User.findById(m.studentId).select("classId classIds instituteId role active");
    if (!s || s.role !== "student" || !s.active) throw ApiError.badRequest("Invalid student in marks");
    if (!s.instituteId || String(s.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
    const studentClassIds = [s.classId, ...(Array.isArray(s.classIds) ? s.classIds : [])].filter(Boolean).map(String);
    if (!studentClassIds.includes(String(test.classId))) throw ApiError.badRequest("Student does not belong to this class");
  }
  await TestMark.bulkWrite(
    marks.map((m) => ({
      updateOne: {
        filter: { testId: test._id, studentId: new Types.ObjectId(m.studentId) },
        update: { $set: { marks: m.marks, instituteId: new Types.ObjectId(instituteId) } },
        upsert: true,
      },
    })),
  );
  return { testId: String(test._id), saved: marks.length };
}

export async function publishResult(actor: { id: string; role: string }, instituteId: string, input: { classId: string; exam: string; studentId: string; subjects: { name: string; marks: number; max: number }[] }) {
  if (actor.role === "teacher") await requireOwnedClassForTeacher(input.classId, actor.id, instituteId);
  else await requireClassInInstitute(input.classId, instituteId);
  assertObjectId(input.studentId);
  const s = await User.findById(input.studentId).select("classId classIds instituteId role active");
  if (!s || s.role !== "student" || !s.active) throw ApiError.badRequest("Invalid student");
  if (!s.instituteId || String(s.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  const studentClassIds = [s.classId, ...(Array.isArray(s.classIds) ? s.classIds : [])].filter(Boolean).map(String);
  if (!studentClassIds.includes(input.classId)) throw ApiError.badRequest("Student does not belong to this class");
  const { Class } = await import("../models/Class.js");
  const teachers = await User.find({ instituteId: new Types.ObjectId(instituteId), role: "teacher", active: true }).select("subject").lean();
  void teachers;
  const klass = await Class.findById(input.classId).select("name section").lean();
  void klass;
  const row = await Result.findOneAndUpdate(
    { instituteId: new Types.ObjectId(instituteId), classId: new Types.ObjectId(input.classId), exam: input.exam.trim(), studentId: s._id },
    { $set: { subjects: input.subjects, enteredBy: new Types.ObjectId(actor.id) } },
    { upsert: true, new: true },
  );
  return { id: String(row!._id), exam: row!.exam };
}

export interface StudentResultRow {
  exam: string;
  classId: string;
  subjects: { name: string; marks: number; max: number; percent: number; teacher?: string }[];
  total: number;
  maxTotal: number;
  percent: number;
}

/** Student read-only aggregates for bar/pie charts. Teacher/class joined per subject where known. */
export async function myResults(studentId: string, instituteId: string, exam?: string) {
  const me = await User.findById(studentId).select("classId classIds");
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    studentId: new Types.ObjectId(studentId),
  };
  if (exam) filter.exam = exam;
  const rows = await Result.find(filter).sort({ createdAt: -1 }).lean();
  const { Timetable } = await import("../models/Timetable.js");
  const classId = me?.classId ? String(me.classId) : Array.isArray(me?.classIds) && me.classIds.length ? String(me.classIds[0]) : null;
  let subjectTeacher: Record<string, string> = {};
  if (classId) {
    const slots = await Timetable.find({ instituteId: new Types.ObjectId(instituteId), classId: new Types.ObjectId(classId), active: true }).lean();
    const teacherIds = [...new Set(slots.map((s) => String(s.teacherId)))];
    const teachers = teacherIds.length ? await User.find({ _id: { $in: teacherIds } }).select("name").lean() : [];
    const nameById = new Map(teachers.map((t) => [String(t._id), t.name]));
    for (const s of slots) {
      if (!subjectTeacher[s.subject]) subjectTeacher[s.subject] = nameById.get(String(s.teacherId)) ?? "";
    }
  }
  const data: StudentResultRow[] = rows.map((r) => {
    const subjects = r.subjects.map((s) => ({
      name: s.name,
      marks: s.marks,
      max: s.max,
      percent: s.max === 0 ? 0 : Math.round((s.marks / s.max) * 100),
      teacher: subjectTeacher[s.name] ?? "",
      class: classId ?? "",
    }));
    const total = subjects.reduce((a, s) => a + s.marks, 0);
    const maxTotal = subjects.reduce((a, s) => a + s.max, 0);
    return { exam: r.exam, classId: String(r.classId), subjects: subjects as never, total, maxTotal, percent: maxTotal === 0 ? 0 : Math.round((total / maxTotal) * 100) };
  });
  const exams = [...new Set(rows.map((r) => r.exam))];
  return { data, exams };
}

export async function listResults(instituteId: string, query: { classId?: string; exam?: string; studentId?: string }, viewer: { role: string; id: string }) {
  if (viewer.role === "student") {
    return myResults(viewer.id, instituteId, query.exam);
  }
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };
  if (query.classId) {
    await requireClassInInstitute(query.classId, instituteId);
    filter.classId = new Types.ObjectId(query.classId);
  }
  if (query.exam) filter.exam = query.exam;
  if (query.studentId) {
    assertObjectId(query.studentId);
    filter.studentId = new Types.ObjectId(query.studentId);
  }
  if (viewer.role === "teacher" && query.classId) {
    await requireOwnedClassForTeacher(query.classId, viewer.id, instituteId);
  }
  const rows = await Result.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return rows.map((r) => ({ id: String(r._id), classId: String(r.classId), exam: r.exam, studentId: String(r.studentId), subjects: r.subjects }));
}
