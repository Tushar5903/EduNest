import { Types } from "mongoose";
import { Class } from "../models/Class.js";
import { Institute } from "../models/Institute.js";
import { PromotionLog } from "../models/PromotionLog.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { nextRollNo } from "../utils/idGenerator.js";
import { assertObjectId, requireClassInInstitute } from "../utils/scope.js";

export interface PromoteInput {
  studentIds?: string[];
  entireClass?: boolean;
  fromClassId: string;
  toClassId?: string;
}

async function assertTerminalGate(instituteId: string, fromClassId: string): Promise<void> {
  const inst = await Institute.findById(instituteId).select("settings").lean();
  const terminal = (inst?.settings as { terminalClassId?: unknown } | undefined)?.terminalClassId;
  if (terminal && String(terminal) === String(fromClassId)) {
    throw ApiError.forbidden("Cannot promote beyond terminal standard — pass-out/transfer only");
  }
}

async function nextRoll(instituteId: string, classId: Types.ObjectId): Promise<number> {
  const existing = await User.distinct("rollNo", {
    instituteId: new Types.ObjectId(instituteId),
    classId,
    role: "student",
    active: true,
    rollNo: { $type: "number" },
  });
  return nextRollNo(existing as number[]);
}

export async function promote(
  actor: { id: string; role: string },
  instituteId: string,
  input: PromoteInput,
) {
  const fromClass = await requireClassInInstitute(input.fromClassId, instituteId);
  await assertTerminalGate(instituteId, String(fromClass._id));

  // Teacher may only promote from classes they own.
  if (actor.role === "teacher") {
    if (String((fromClass as { teacherId?: unknown }).teacherId ?? "") !== actor.id) {
      throw ApiError.forbidden("Forbidden for this class");
    }
  }

  let studentIds = input.studentIds ?? [];
  if (input.entireClass) {
    const rows = await User.find({
      instituteId: new Types.ObjectId(instituteId),
      classId: fromClass._id,
      role: "student",
      active: true,
    }).select("_id");
    studentIds = rows.map((r) => String(r._id));
  }
  if (studentIds.length === 0) throw ApiError.badRequest("No students to promote");
  if (!input.toClassId) throw ApiError.badRequest("toClassId required (terminal class uses pass-out)");

  const toClass = await requireClassInInstitute(input.toClassId, instituteId);
  // Forward-only: target order must be greater than source order.
  const fromOrder = (fromClass as { order?: number }).order ?? 0;
  const toOrder = (toClass as { order?: number }).order ?? 0;
  if (toOrder <= fromOrder) throw ApiError.badRequest("Promote is forward-only to a higher class");

  const results: { id: string; rollNo: number }[] = [];
  for (const sid of studentIds) {
    assertObjectId(sid);
    const s = await User.findById(sid);
    if (!s || s.role !== "student" || !s.active) throw ApiError.badRequest(`Invalid student: ${sid}`);
    if (!s.instituteId || String(s.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
    if (!s.classId || String(s.classId) !== String(fromClass._id)) throw ApiError.badRequest(`Student not in source class: ${sid}`);
    const rollNo = await nextRoll(instituteId, toClass._id as Types.ObjectId);
    s.classId = toClass._id as never;
    s.rollNo = rollNo;
    await s.save();
    await PromotionLog.create({
      instituteId: new Types.ObjectId(instituteId),
      by: new Types.ObjectId(actor.id),
      studentId: s._id,
      fromClassId: fromClass._id,
      toClassId: toClass._id,
      action: "promote",
    });
    results.push({ id: String(s._id), rollNo });
  }
  return { promoted: results.length, results, fromClassId: String(fromClass._id), toClassId: String(toClass._id) };
}
