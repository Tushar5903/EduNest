import { Types } from "mongoose";
import { Salary } from "../models/Salary.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";

function toPayload(s: { _id: unknown; teacherId: unknown; month: string; amount: number; status: string; paidAt?: Date | null }) {
  return { id: String(s._id), teacherId: String(s.teacherId), month: s.month, amount: s.amount, status: s.status, paidAt: s.paidAt ?? null };
}

export async function listSalaries(instituteId: string, query: { teacherId?: string; month?: string; status?: string }, viewer: { role: string; id: string }) {
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId) };
  if (viewer.role === "teacher") {
    filter.teacherId = new Types.ObjectId(viewer.id);
  } else if (query.teacherId) {
    assertObjectId(query.teacherId);
    filter.teacherId = new Types.ObjectId(query.teacherId);
  }
  if (query.month) filter.month = query.month;
  if (query.status) filter.status = query.status;
  const rows = await Salary.find(filter).sort({ month: -1 }).limit(200);
  return rows.map((s) => toPayload(s as never));
}

export async function createSalary(adminId: string, instituteId: string, input: { teacherId: string; month: string; amount: number }) {
  assertObjectId(input.teacherId);
  const t = await User.findById(input.teacherId).select("instituteId role active");
  if (!t || t.role !== "teacher" || !t.active) throw ApiError.badRequest("Invalid teacher");
  if (!t.instituteId || String(t.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  try {
    const row = await Salary.create({
      instituteId: new Types.ObjectId(instituteId),
      teacherId: t._id,
      month: input.month,
      amount: input.amount,
      status: "pending",
    });
    return toPayload(row as never);
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) throw ApiError.conflict("Salary already exists for this teacher+month");
    throw err;
  }
}

export async function updateSalary(_adminId: string, instituteId: string, salaryId: string, input: { amount?: number; status?: "pending" | "paid" }) {
  assertObjectId(salaryId);
  const row = await Salary.findById(salaryId);
  if (!row) throw ApiError.notFound("Salary not found");
  if (String(row.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (input.amount !== undefined) row.amount = input.amount;
  if (input.status !== undefined) {
    row.status = input.status;
    row.paidAt = input.status === "paid" ? new Date() : null;
  }
  await row.save();
  return toPayload(row as never);
}

export async function mySalary(teacherId: string, instituteId: string, query: { month?: string; status?: string }) {
  return listSalaries(instituteId, query, { role: "teacher", id: teacherId });
}
