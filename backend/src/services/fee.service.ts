import { Types } from "mongoose";
import { Fee, FeeAudit } from "../models/Fee.js";
import { User } from "../models/User.js";
import { Class } from "../models/Class.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";
import { todayISO } from "../utils/date.js";

export interface FeePayload {
  id: string;
  studentId: string;
  studentName?: string;
  studentLoginId?: string;
  amount: number;
  dueDate: string;
  head?: string;
  status: string;
  paidAt: Date | null;
  overdue: boolean;
}

export async function calculateStudentFee(studentId: string, instituteId: string): Promise<number> {
  const student = await User.findOne({ _id: new Types.ObjectId(studentId), instituteId: new Types.ObjectId(instituteId), role: "student" }).select("classId classIds");
  const ids = student?.classIds?.length ? student.classIds : student?.classId ? [student.classId] : [];
  if (!ids.length) return 0;
  const classes = await Class.find({ _id: { $in: ids }, instituteId: new Types.ObjectId(instituteId) }).select("feeAmount");
  return classes.reduce((sum, klass) => sum + (klass.feeAmount ?? 800), 0);
}

function toPayload(f: { _id: unknown; amount: number; dueDate: string; head?: string; status: string; paidAt?: Date | null }): FeePayload {
  const rawStudent = (f as { studentId?: unknown }).studentId;
  const populated = (rawStudent !== null && typeof rawStudent === "object" ? (rawStudent as { _id?: unknown; name?: string; loginId?: string }) : null);
  return {
    id: String(f._id),
    studentId: String(populated?._id ?? rawStudent ?? ""),
    studentName: populated?.name ?? undefined,
    studentLoginId: populated?.loginId ?? undefined,
    amount: f.amount,
    dueDate: f.dueDate,
    head: f.head,
    status: f.status,
    paidAt: f.paidAt ?? null,
    overdue: f.status !== "paid" && f.dueDate < todayISO(),
  };
}

/** Flip past-due unpaid fees to overdue. Runs lazily on reads so lists,
 * filters, and dues always reflect the due date. Paid rows are never touched.
 * Each row transitions once; one system audit entry is written per row. */
async function applyAutoOverdue(instituteId: string) {
  const today = todayISO();
  const stale = await Fee.find({
    instituteId: new Types.ObjectId(instituteId),
    status: { $nin: ["paid", "overdue"] },
    dueDate: { $lt: today },
  }).select("_id status");
  if (!stale.length) return;
  await Fee.updateMany(
    { _id: { $in: stale.map((f) => f._id) } },
    { $set: { status: "overdue", paidAt: null } },
  );
  await FeeAudit.insertMany(
    stale.map((f) => ({
      feeId: f._id,
      instituteId: new Types.ObjectId(instituteId),
      oldStatus: f.status,
      newStatus: "overdue",
      by: "system",
    })),
  );
}

/** Student read-only: own dues + history. Never another student's rows. */
export async function myFees(studentId: string, instituteId: string) {
  await applyAutoOverdue(instituteId);
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
  await applyAutoOverdue(instituteId);
  const rows = await Fee.find(filter).sort({ dueDate: 1 }).limit(200).populate("studentId", "name loginId").lean();
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
  const calculatedAmount = await calculateStudentFee(input.studentId, instituteId);
  const fee = await Fee.create({
    instituteId: new Types.ObjectId(instituteId),
    studentId: s._id,
    amount: calculatedAmount,
    dueDate: input.dueDate,
    head: input.head?.trim(),
    status: "pending",
  });
  await FeeAudit.create({ feeId: fee._id, instituteId: new Types.ObjectId(instituteId), oldStatus: "none", newStatus: "pending", by: new Types.ObjectId(adminId) });
  return toPayload(fee as never);
}

/** Admin: amount/due edit + mark paid. Manual status changes are paid-only;
 * overdue is applied automatically once the due date passes. */
export async function updateFee(adminId: string, instituteId: string, feeId: string, input: { amount?: number; dueDate?: string; status?: string }) {
  assertObjectId(feeId);
  const fee = await Fee.findById(feeId);
  if (!fee) throw ApiError.notFound("Fee not found");
  if (String(fee.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  const old = fee.status;
  if (input.amount !== undefined) fee.amount = input.amount;
  if (input.dueDate !== undefined) fee.dueDate = input.dueDate;
  if (input.status !== undefined) {
    if (input.status !== "paid") throw ApiError.badRequest("Fee status can only be marked paid manually; overdue is applied automatically");
    fee.status = "paid";
    fee.paidAt = new Date();
  }
  await fee.save();
  await FeeAudit.create({ feeId: fee._id, instituteId: new Types.ObjectId(instituteId), oldStatus: old, newStatus: fee.status, by: new Types.ObjectId(adminId) });
  return toPayload(fee as never);
}

/** Teacher limited: any unpaid (pending|submitted|collected|overdue) -> paid + remark.
 * Only teachers (own class) and admins can mark fees paid. Amount touch forbidden upstream. */
export async function teacherFeeStatus(teacherId: string, instituteId: string, feeId: string, input: { status: "paid"; remark?: string }) {
  assertObjectId(feeId);
  const fee = await Fee.findById(feeId).populate("studentId");
  if (!fee) throw ApiError.notFound("Fee not found");
  if (String(fee.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (fee.status === "paid") throw ApiError.badRequest("This fee is already paid");
  if (!["pending", "submitted", "collected", "overdue"].includes(fee.status)) throw ApiError.badRequest("Only unpaid fees can be marked paid");
  const student = await User.findById(fee.studentId).select("classId");
  const { Class } = await import("../models/Class.js");
  const klass = student?.classId ? await Class.findById(student.classId).select("teacherId") : null;
  if (!klass || String(klass.teacherId ?? "") !== teacherId) throw ApiError.forbidden("Forbidden for this class");
  const old = fee.status;
  fee.status = "paid";
  fee.paidAt = new Date();
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
