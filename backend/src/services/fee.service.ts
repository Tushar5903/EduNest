import { Types } from "mongoose";
import { Fee, FeeAudit } from "../models/Fee.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";
import { todayISO } from "../utils/date.js";

export interface FeePayload {
  id: string;
  amount: number;
  dueDate: string;
  head?: string;
  status: string;
  paidAt: Date | null;
  overdue: boolean;
}

function toPayload(f: { _id: unknown; amount: number; dueDate: string; head?: string; status: string; paidAt?: Date | null }): FeePayload {
  return {
    id: String(f._id),
    amount: f.amount,
    dueDate: f.dueDate,
    head: f.head,
    status: f.status,
    paidAt: f.paidAt ?? null,
    overdue: f.status !== "paid" && f.dueDate < todayISO(),
  };
}

/** Student read-only: own dues + history. Never another student's rows. */
export async function myFees(studentId: string, instituteId: string) {
  const rows = await Fee.find({
    instituteId: new Types.ObjectId(instituteId),
    studentId: new Types.ObjectId(studentId),
  }).sort({ dueDate: 1 });
  const data = rows.map((f) => toPayload(f as never));
  const due = data.filter((d) => d.status !== "paid").reduce((s, d) => s + d.amount, 0);
  const paid = data.filter((d) => d.status === "paid").reduce((s, d) => s + d.amount, 0);
  return { data, due, paid, total: data.length };
}

/** Scoped list: admin all (+filters), teacher status-mirror for own classes, student self. */
export async function listFees(
  instituteId: string,
  query: { classId?: string; studentId?: string; status?: string },
  viewer: { role: string; id: string },
) {
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };
  if (viewer.role === "student") {
    filter.studentId = new Types.ObjectId(viewer.id);
  } else if (query.studentId) {
    assertObjectId(query.studentId);
    if (viewer.role === "teacher") {
      const s = await User.findById(query.studentId).select("classId instituteId role");
      if (!s || String(s.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
      const { Class } = await import("../models/Class.js");
      const klass = s.classId ? await Class.findById(s.classId).select("teacherId") : null;
      if (!klass || String(klass.teacherId ?? "") !== viewer.id) throw ApiError.forbidden("Forbidden for this class");
    }
    filter.studentId = new Types.ObjectId(query.studentId);
  } else if (query.classId) {
    assertObjectId(query.classId);
    const students = await User.find({
      instituteId: new Types.ObjectId(instituteId),
      classId: new Types.ObjectId(query.classId),
      role: "student",
      active: true,
    }).select("_id");
    if (viewer.role === "teacher") {
      const { Class } = await import("../models/Class.js");
      const klass = await Class.findById(query.classId).select("teacherId");
      if (!klass || String(klass.teacherId ?? "") !== viewer.id) throw ApiError.forbidden("Forbidden for this class");
    }
    filter.studentId = { $in: students.map((s) => s._id) };
  } else if (viewer.role === "teacher") {
    const { Class } = await import("../models/Class.js");
    const owned = await Class.find({ teacherId: new Types.ObjectId(viewer.id), instituteId: new Types.ObjectId(instituteId) }).select("_id");
    const students = await User.find({
      instituteId: new Types.ObjectId(instituteId),
      classId: { $in: owned.map((c) => c._id) },
      role: "student",
      active: true,
    }).select("_id");
    filter.studentId = { $in: students.map((s) => s._id) };
  }
  if (query.status) filter.status = query.status;
  const rows = await Fee.find(filter).sort({ dueDate: 1 }).limit(200);
  // Teacher mirror: status only (amount hidden is a frontend rule; API keeps amount for receipts admin-side).
  // Student rows already scoped to self above.
  return rows.map((f) => toPayload(f as never));
}

/** Admin create due (minimal Phase-1: heads + amount/due). */
export async function createFee(adminId: string, instituteId: string, input: { studentId: string; amount: number; dueDate: string; head?: string }) {
  assertObjectId(input.studentId);
  const s = await User.findById(input.studentId).select("instituteId role active");
  if (!s || s.role !== "student" || !s.active) throw ApiError.badRequest("Invalid student");
  if (!s.instituteId || String(s.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  const fee = await Fee.create({
    instituteId: new Types.ObjectId(instituteId),
    studentId: s._id,
    amount: input.amount,
    dueDate: input.dueDate,
    head: input.head?.trim(),
    status: "pending",
  });
  await FeeAudit.create({ feeId: fee._id, instituteId: new Types.ObjectId(instituteId), oldStatus: "none", newStatus: "pending", by: new Types.ObjectId(adminId) });
  return toPayload(fee as never);
}

/** Admin full update: amount/due edit, submitted->paid verify, revert. */
export async function updateFee(adminId: string, instituteId: string, feeId: string, input: { amount?: number; dueDate?: string; status?: string }) {
  assertObjectId(feeId);
  const fee = await Fee.findById(feeId);
  if (!fee) throw ApiError.notFound("Fee not found");
  if (String(fee.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  const old = fee.status;
  if (input.amount !== undefined) fee.amount = input.amount;
  if (input.dueDate !== undefined) fee.dueDate = input.dueDate;
  if (input.status !== undefined) {
    fee.status = input.status as never;
    fee.paidAt = input.status === "paid" ? new Date() : null;
  }
  await fee.save();
  await FeeAudit.create({ feeId: fee._id, instituteId: new Types.ObjectId(instituteId), oldStatus: old, newStatus: fee.status, by: new Types.ObjectId(adminId) });
  return toPayload(fee as never);
}

/** Teacher limited: pending -> submitted|collected + remark. Amount touch forbidden upstream. */
export async function teacherFeeStatus(teacherId: string, instituteId: string, feeId: string, input: { status: "submitted" | "collected"; remark?: string }) {
  assertObjectId(feeId);
  const fee = await Fee.findById(feeId).populate("studentId");
  if (!fee) throw ApiError.notFound("Fee not found");
  if (String(fee.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (fee.status !== "pending") throw ApiError.badRequest("Only pending fees can be marked submitted/collected");
  const student = await User.findById(fee.studentId).select("classId");
  const { Class } = await import("../models/Class.js");
  const klass = student?.classId ? await Class.findById(student.classId).select("teacherId") : null;
  if (!klass || String(klass.teacherId ?? "") !== teacherId) throw ApiError.forbidden("Forbidden for this class");
  const old = fee.status;
  fee.status = input.status;
  await fee.save();
  await FeeAudit.create({
    feeId: fee._id,
    instituteId: new Types.ObjectId(instituteId),
    oldStatus: old,
    newStatus: fee.status,
    by: new Types.ObjectId(teacherId),
    remark: input.remark?.trim(),
  });
  return toPayload(fee as never);
}

export async function feeAudit(instituteId: string, feeId: string) {
  assertObjectId(feeId);
  const fee = await Fee.findById(feeId).select("instituteId");
  if (!fee) throw ApiError.notFound("Fee not found");
  if (String(fee.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  return FeeAudit.find({ feeId: fee._id }).sort({ at: -1 }).lean();
}
