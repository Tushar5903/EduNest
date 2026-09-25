import { Types } from "mongoose";
import { Attendance, type AttendanceDoc } from "../models/Attendance.js";
import { AuditLog } from "../models/AuditLog.js";
import { Class } from "../models/Class.js";
import { Timetable } from "../models/Timetable.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { todayISO } from "../utils/date.js";
import { assertObjectId } from "../utils/scope.js";

export interface AttendanceMark {
  studentId: string;
  status: "present" | "absent";
}

export interface AttendancePayload {
  id: string;
  classId: string;
  date: string;
  periodId: string;
  records: { studentId: string; studentName: string; status: string }[];
  markedBy: string | null;
}

async function payloadize(rows: AttendanceDoc[]): Promise<AttendancePayload[]> {
  const studentIds = [...new Set(rows.flatMap((r) => r.records.map((rec) => String(rec.studentId))))];
  const students = studentIds.length
    ? await User.find({ _id: { $in: studentIds } }).select("name").lean()
    : [];
  const nameById = new Map(students.map((s) => [String(s._id), s.name]));
  return rows.map((r) => ({
    id: String(r._id),
    classId: String(r.classId),
    date: r.date,
    periodId: String(r.periodId),
    records: r.records.map((rec) => ({
      studentId: String(rec.studentId),
      studentName: nameById.get(String(rec.studentId)) ?? "",
      status: rec.status,
    })),
    markedBy: r.markedBy ? String(r.markedBy) : null,
  }));
}

async function requireClassInInstitute(classId: string, instituteId: string) {
  assertObjectId(classId);
  const klass = await Class.findById(classId);
  if (!klass) throw ApiError.notFound("Class not found");
  if (String(klass.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (!klass.active) throw ApiError.badRequest("Class is no longer active");
  return klass;
}

async function requireOwnedClass(classId: string, teacherId: string, instituteId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (String(klass.teacherId ?? "") !== teacherId) throw ApiError.forbidden("Forbidden for this class");
  return klass;
}

async function requirePeriodInClass(periodId: string, classId: Types.ObjectId, instituteId: string) {
  assertObjectId(periodId);
  const period = await Timetable.findById(periodId);
  if (!period || !period.active) throw ApiError.notFound("Period not found");
  if (String(period.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (String(period.classId) !== String(classId)) {
    throw ApiError.badRequest("Period does not belong to this class");
  }
  return period;
}

/** Every student must exist, be an active student of this institute + class. */
async function validateRecords(records: AttendanceMark[], classId: Types.ObjectId, instituteId: string) {
  const seen = new Set<string>();
  for (const rec of records) {
    assertObjectId(rec.studentId);
    if (seen.has(rec.studentId)) throw ApiError.badRequest("Duplicate student in attendance records");
    seen.add(rec.studentId);
  }
  const students = await User.find({
    _id: { $in: [...seen].map((id) => new Types.ObjectId(id)) },
    role: "student",
    active: true,
  }).select("classId instituteId");
  if (students.length !== seen.size) throw ApiError.badRequest("Unknown or inactive student in records");
  for (const s of students) {
    if (!s.instituteId || String(s.instituteId) !== instituteId) {
      throw ApiError.forbidden("Cross-institute access denied");
    }
    if (!s.classId || String(s.classId) !== String(classId)) {
      throw ApiError.badRequest("Student does not belong to this class");
    }
  }
  return records.map((rec) => ({ studentId: new Types.ObjectId(rec.studentId), status: rec.status }));
}

// ---------------------------------------------------------------------------
// MARK — teacher (own class) / admin. Same class-period-day upserts.
// ---------------------------------------------------------------------------
export interface MarkAttendanceInput {
  classId: string;
  date: string;
  periodId: string;
  records: AttendanceMark[];
}

export async function markAttendance(
  actor: { id: string; role: string },
  instituteId: string,
  input: MarkAttendanceInput,
) {
  const klass =
    actor.role === "teacher"
      ? await requireOwnedClass(input.classId, actor.id, instituteId)
      : await requireClassInInstitute(input.classId, instituteId);
  const period = await requirePeriodInClass(input.periodId, klass._id as Types.ObjectId, instituteId);
  const records = await validateRecords(input.records, klass._id as Types.ObjectId, instituteId);

  const existing = await Attendance.findOne({ classId: klass._id, periodId: period._id, date: input.date });
  if (existing) {
    existing.records = records as never;
    existing.markedBy = new Types.ObjectId(actor.id) as never;
    await existing.save();
    await AuditLog.create({ by: actor.id, instituteId, action: "attendance.updated" });
    return { upserted: true as const, attendance: (await payloadize([existing]))[0] };
  }
  try {
    const created = await Attendance.create({
      instituteId: new Types.ObjectId(instituteId),
      classId: klass._id,
      date: input.date,
      periodId: period._id,
      records,
      markedBy: new Types.ObjectId(actor.id),
    });
    await AuditLog.create({ by: actor.id, instituteId, action: "attendance.marked" });
    return { upserted: false as const, attendance: (await payloadize([created]))[0] };
  } catch (err) {
    // Race backstop: unique (classId, periodId, date) fired between check and insert.
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000) {
      const raced = await Attendance.findOne({ classId: klass._id, periodId: period._id, date: input.date });
      if (!raced) throw err;
      raced.records = records as never;
      raced.markedBy = new Types.ObjectId(actor.id) as never;
      await raced.save();
      await AuditLog.create({ by: actor.id, instituteId, action: "attendance.updated" });
      return { upserted: true as const, attendance: (await payloadize([raced]))[0] };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// LIST — admin (own institute + filters); teacher (own classes); student (self).
// ---------------------------------------------------------------------------
export interface ListAttendanceQuery {
  classId?: string;
  date?: string;
  month?: string;
  studentId?: string;
}

export async function listAttendance(
  instituteId: string,
  query: ListAttendanceQuery,
  viewer: { role: string; id: string },
) {
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };

  if (viewer.role === "student") {
    // Identity forced server-side — query studentId never trusted.
    const docs = await Attendance.find({ ...filter, "records.studentId": new Types.ObjectId(viewer.id) }).sort({
      date: 1,
    });
    return (await payloadize(docs)).map((d) => {
      const rec = d.records.find((r) => r.studentId === viewer.id)!;
      return { id: d.id, classId: d.classId, date: d.date, periodId: d.periodId, status: rec.status };
    }).filter((d) => {
      if (query.date && d.date !== query.date) return false;
      if (query.month && !d.date.startsWith(query.month)) return false;
      return true;
    });
  }

  if (viewer.role === "teacher") {
    const owned = await Class.find({
      teacherId: new Types.ObjectId(viewer.id),
      instituteId: new Types.ObjectId(instituteId),
      active: true,
    }).select("_id");
    const ownedIds = owned.map((c) => String(c._id));
    if (query.classId) {
      assertObjectId(query.classId);
      if (!ownedIds.includes(query.classId)) throw ApiError.forbidden("Forbidden for this class");
      filter.classId = new Types.ObjectId(query.classId);
    } else {
      filter.classId = { $in: owned.map((c) => c._id) };
    }
  } else if (query.classId) {
    await requireClassInInstitute(query.classId, instituteId);
    filter.classId = new Types.ObjectId(query.classId);
  }

  if (query.date) filter.date = query.date;
  else if (query.month) filter.date = { $regex: `^${query.month}` };
  if (query.studentId) {
    assertObjectId(query.studentId);
    filter["records.studentId"] = new Types.ObjectId(query.studentId);
  }

  const docs = await Attendance.find(filter).sort({ date: 1 });
  return payloadize(docs);
}

// ---------------------------------------------------------------------------
// MY ATTENDANCE — student only. Day list + monthly percentage.
// ---------------------------------------------------------------------------
export async function myAttendance(studentId: string, instituteId: string, month?: string) {
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    "records.studentId": new Types.ObjectId(studentId),
  };
  if (month) filter.date = { $regex: `^${month}` };
  const docs = await Attendance.find(filter).sort({ date: 1 });

  const days = docs.map((d) => {
    const rec = d.records.find((r) => String(r.studentId) === studentId)!;
    return { date: d.date, classId: String(d.classId), periodId: String(d.periodId), status: rec.status };
  });
  const present = days.filter((d) => d.status === "present").length;
  const total = days.length;
  // Only recorded days count — unrecorded days are never treated as absent.
  const percent = total === 0 ? 0 : Math.round((present / total) * 100);
  return { days, present, absent: total - present, total, percent };
}

// ---------------------------------------------------------------------------
// EDIT — admin anytime; teacher same-calendar-day + owned class only.
// ---------------------------------------------------------------------------
export async function updateAttendance(
  actor: { id: string; role: string },
  instituteId: string,
  attendanceId: string,
  records: AttendanceMark[],
) {
  assertObjectId(attendanceId);
  const doc = await Attendance.findById(attendanceId);
  if (!doc) throw ApiError.notFound("Attendance not found");
  if (String(doc.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");

  if (actor.role === "teacher") {
    const klass = await Class.findById(doc.classId).select("teacherId");
    if (!klass || String(klass.teacherId ?? "") !== actor.id) {
      throw ApiError.forbidden("Forbidden for this class");
    }
    if (doc.date !== todayISO()) {
      throw ApiError.forbidden("Only today's attendance can be edited — contact admin for older records");
    }
  }

  const clean = await validateRecords(records, doc.classId as Types.ObjectId, instituteId);
  doc.records = clean as never;
  doc.markedBy = new Types.ObjectId(actor.id) as never;
  await doc.save();
  await AuditLog.create({ by: actor.id, instituteId, action: "attendance.updated" });
  return (await payloadize([doc]))[0];
}
