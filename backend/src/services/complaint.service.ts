import { Types } from "mongoose";
import { Class } from "../models/Class.js";
import { Complaint } from "../models/Complaint.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";
import { todayISO } from "../utils/date.js";

export interface CreateComplaintInput {
  toType: "teacher" | "admin";
  toTeacherId?: string;
  category: "against-student" | "against-teacher" | "other";
  targetStudentId?: string;
  targetTeacherId?: string;
  subject: string;
  body: string;
}

function dayBounds(): { start: Date; end: Date } {
  const day = todayISO();
  return { start: new Date(`${day}T00:00:00.000Z`), end: new Date(`${day}T23:59:59.999Z`) };
}

/** Teachers allowed for this student: class teacher + timetable teachers of own class. */
async function allowedTeacherIds(studentId: string, instituteId: string): Promise<Set<string>> {
  const me = await User.findById(studentId).select("classId");
  if (!me?.classId) return new Set();
  const klass = await Class.findById(me.classId).select("teacherId instituteId");
  const ids = new Set<string>();
  if (klass?.teacherId) ids.add(String(klass.teacherId));
  const { Timetable } = await import("../models/Timetable.js");
  const slots = await Timetable.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass!._id,
    active: true,
  })
    .select("teacherId")
    .lean();
  for (const s of slots) ids.add(String(s.teacherId));
  return ids;
}

export async function createComplaint(studentId: string, instituteId: string, input: CreateComplaintInput) {
  const me = await User.findById(studentId).select("classId instituteId role active");
  if (!me || me.role !== "student" || !me.active) throw ApiError.forbidden("Only students can file complaints");
  if (!me.classId) throw ApiError.badRequest("You must belong to a class to file a complaint");

  // 2/day server-side limit — counts today's submissions (all statuses count).
  const { start, end } = dayBounds();
  const todayCount = await Complaint.countDocuments({
    instituteId: new Types.ObjectId(instituteId),
    fromStudentId: new Types.ObjectId(studentId),
    createdAt: { $gte: start, $lte: end },
  });
  if (todayCount >= 2) {
    const err = ApiError.forbidden("Complaint limit reached — you can file 2 complaints per day. Try again tomorrow.");
    (err as ApiError).status = 429;
    throw err;
  }

  let toTeacher: typeof User.prototype | null = null;
  if (input.toType === "teacher") {
    assertObjectId(input.toTeacherId!);
    const allowed = await allowedTeacherIds(studentId, instituteId);
    if (!allowed.has(input.toTeacherId!)) throw ApiError.badRequest("Selected teacher is not one of your teachers");
    toTeacher = await User.findById(input.toTeacherId!);
    if (!toTeacher || toTeacher.role !== "teacher") throw ApiError.badRequest("Invalid teacher recipient");
    if (!toTeacher.instituteId || String(toTeacher.instituteId) !== instituteId) {
      throw ApiError.forbidden("Cross-institute access denied");
    }
  }

  // Target validation: classmate must be in same class; target teacher must be allowed.
  let targetStudent: typeof User.prototype | null = null;
  if (input.targetStudentId) {
    assertObjectId(input.targetStudentId);
    targetStudent = await User.findById(input.targetStudentId);
    if (!targetStudent || targetStudent.role !== "student") throw ApiError.badRequest("Invalid classmate selected");
    if (!targetStudent.instituteId || String(targetStudent.instituteId) !== instituteId) {
      throw ApiError.forbidden("Cross-institute access denied");
    }
    if (!targetStudent.classId || String(targetStudent.classId) !== String(me.classId)) {
      throw ApiError.badRequest("You can only complain about classmates in your own class");
    }
    if (String(targetStudent._id) === studentId) throw ApiError.badRequest("You cannot complain about yourself");
  }
  if (input.targetTeacherId) {
    assertObjectId(input.targetTeacherId);
    const allowed = await allowedTeacherIds(studentId, instituteId);
    if (!allowed.has(input.targetTeacherId)) throw ApiError.badRequest("Selected teacher is not one of your teachers");
  }

  const doc = await Complaint.create({
    instituteId: new Types.ObjectId(instituteId),
    fromStudentId: new Types.ObjectId(studentId),
    toType: input.toType,
    toTeacherId: input.toType === "teacher" ? new Types.ObjectId(input.toTeacherId!) : null,
    category: input.category,
    targetStudentId: input.targetStudentId ? new Types.ObjectId(input.targetStudentId) : null,
    targetTeacherId: input.targetTeacherId ? new Types.ObjectId(input.targetTeacherId) : null,
    subject: input.subject.trim(),
    body: input.body.trim(),
    status: "open",
  });
  void toTeacher;
  void targetStudent;
  return { id: String(doc._id), status: doc.status };
}

export function toComplaintPayload(c: {
  _id: unknown;
  toType: string;
  status: string;
  subject: string;
  body?: string;
  category: string;
  replies: { by: unknown; role: string; body: string; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
  toTeacherId?: unknown;
}) {
  return {
    id: String(c._id),
    toType: c.toType,
    status: c.status,
    subject: c.subject,
    category: c.category,
    replies: c.replies.map((r) => ({ role: r.role, body: r.body, at: r.at })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Student track-only view: own complaints + status + replies. No bodies of others. */
export async function myComplaints(studentId: string, instituteId: string) {
  const rows = await Complaint.find({
    instituteId: new Types.ObjectId(instituteId),
    fromStudentId: new Types.ObjectId(studentId),
  }).sort({ createdAt: -1 });
  return rows.map((c) => toComplaintPayload(c as never));
}

/** Teacher inbox: only toType teacher && toTeacherId == me. Admin rows never leak. */
export async function teacherInbox(teacherId: string, instituteId: string) {
  const rows = await Complaint.find({
    instituteId: new Types.ObjectId(instituteId),
    toType: "teacher",
    toTeacherId: new Types.ObjectId(teacherId),
  }).sort({ createdAt: -1 });
  return rows.map((c) => ({
    id: String(c._id),
    status: c.status,
    subject: c.subject,
    category: c.category,
    body: c.body,
    replies: c.replies,
    createdAt: c.createdAt,
  }));
}

/** Admin: all own-institute (admin full + teacher mirror read-only — mirror flagged by caller). */
export async function adminInbox(instituteId: string, query: { toType?: string; status?: string }) {
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };
  if (query.toType) filter.toType = query.toType;
  if (query.status) filter.status = query.status;
  const rows = await Complaint.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((c) => ({
    id: String(c._id),
    toType: c.toType,
    status: c.status,
    subject: c.subject,
    category: c.category,
    body: c.body,
    replies: c.replies,
    createdAt: c.createdAt,
  }));
}

export async function moderateComplaint(
  actor: { id: string; role: string },
  instituteId: string,
  complaintId: string,
  input: { status: "in-review" | "resolved" | "rejected" | "escalated"; reply?: string },
) {
  assertObjectId(complaintId);
  const doc = await Complaint.findById(complaintId);
  if (!doc) throw ApiError.notFound("Complaint not found");
  if (String(doc.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (actor.role === "teacher") {
    if (doc.toType !== "teacher" || !doc.toTeacherId || String(doc.toTeacherId) !== actor.id) {
      throw ApiError.forbidden("You can only moderate complaints addressed to you");
    }
  } else if (actor.role !== "admin") {
    throw ApiError.forbidden("Forbidden for this role");
  }
  doc.status = input.status;
  if (input.reply) {
    doc.replies.push({ by: new Types.ObjectId(actor.id) as never, role: actor.role, body: input.reply.trim(), at: new Date() });
  }
  await doc.save();
  return { id: String(doc._id), status: doc.status };
}
