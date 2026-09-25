import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Class } from "../models/Class.js";
import { Timetable, type TimetableDoc } from "../models/Timetable.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";
import { nowHM, todayISO, weekdayOf } from "../utils/date.js";

export type SlotState = "LIVE" | "UPCOMING" | "DONE";

export interface TimetablePayload {
  id: string;
  classId: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  type: string;
  active: boolean;
  state?: SlotState;
}

/** HH:MM → minutes since midnight. Validated HH:MM upstream. */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Half-open overlap: [aStart,aEnd) vs [bStart,bEnd). Boundaries never clash. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart);
}

async function payloadize(rows: TimetableDoc[], withState?: (t: TimetableDoc) => SlotState): Promise<TimetablePayload[]> {
  const classIds = [...new Set(rows.map((r) => String(r.classId)))];
  const teacherIds = [...new Set(rows.map((r) => String(r.teacherId)))];
  const [classes, teachers] = await Promise.all([
    Class.find({ _id: { $in: classIds } }).select("name section").lean(),
    User.find({ _id: { $in: teacherIds } }).select("name").lean(),
  ]);
  const classById = new Map(classes.map((c) => [String(c._id), `${c.name}${c.section ? ` ${c.section}` : ""}`]));
  const teacherById = new Map(teachers.map((t) => [String(t._id), t.name]));
  return rows.map((r) => ({
    id: String(r._id),
    classId: String(r.classId),
    className: classById.get(String(r.classId)) ?? "",
    subject: r.subject,
    teacherId: String(r.teacherId),
    teacherName: teacherById.get(String(r.teacherId)) ?? "",
    day: r.day,
    startTime: r.startTime,
    endTime: r.endTime,
    room: r.room,
    type: r.type,
    active: r.active,
    ...(withState ? { state: withState(r) } : {}),
  }));
}

async function requireTeacherInInstitute(teacherId: string, instituteId: string) {
  assertObjectId(teacherId);
  const teacher = await User.findById(teacherId);
  if (!teacher) throw ApiError.notFound("Teacher not found");
  if (!teacher.instituteId || String(teacher.instituteId) !== instituteId) {
    throw ApiError.forbidden("Cross-institute access denied");
  }
  if (teacher.role !== "teacher") throw ApiError.badRequest("Assigned user must be a teacher");
  if (!teacher.active || teacher.status !== "active") {
    throw ApiError.badRequest("Teacher must be active to take a class");
  }
  return teacher;
}

async function requireClassInInstitute(classId: string, instituteId: string) {
  assertObjectId(classId);
  const klass = await Class.findById(classId);
  if (!klass) throw ApiError.notFound("Class not found");
  if (String(klass.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (!klass.active) throw ApiError.badRequest("Class is no longer active");
  return klass;
}

/** Clash = same teacher + same day + overlapping [start,end). Active slots only. */
async function assertNoClash(
  instituteId: string,
  teacherId: Types.ObjectId,
  day: string,
  startTime: string,
  endTime: string,
  excludeId?: Types.ObjectId,
): Promise<void> {
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    teacherId,
    day,
    active: true,
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const existing = await Timetable.find(filter).select("startTime endTime").lean();
  const clash = existing.find((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
  if (clash) {
    throw ApiError.badRequest(
      `Timetable clash: teacher already has ${clash.startTime}–${clash.endTime} on ${day}`,
    );
  }
}

// ---------------------------------------------------------------------------
// CREATE — admin only. instituteId from auth; clash-checked.
// ---------------------------------------------------------------------------
export interface CreateTimetableInput {
  classId: string;
  subject: string;
  teacherId: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  type?: "regular" | "extra" | "cancelled";
}

export async function createTimetable(adminId: string, instituteId: string, input: CreateTimetableInput) {
  const klass = await requireClassInInstitute(input.classId, instituteId);
  const teacher = await requireTeacherInInstitute(input.teacherId, instituteId);
  await assertNoClash(instituteId, teacher._id as Types.ObjectId, input.day, input.startTime, input.endTime);

  const slot = await Timetable.create({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    subject: input.subject.trim(),
    teacherId: teacher._id,
    day: input.day,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room?.trim(),
    type: input.type ?? "regular",
  });
  await AuditLog.create({ by: adminId, instituteId, action: "timetable.created" });
  return (await payloadize([slot]))[0];
}

// ---------------------------------------------------------------------------
// LIST — admin (all + filters); teacher (own slots); student (own class week).
// ---------------------------------------------------------------------------
export interface ListTimetableQuery {
  classId?: string;
  teacherId?: string;
  day?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export async function listTimetables(
  instituteId: string,
  query: ListTimetableQuery,
  viewer: { role: string; id: string },
) {
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    active: true,
  };
  if (viewer.role === "teacher") {
    filter.teacherId = new Types.ObjectId(viewer.id);
    if (query.classId) {
      assertObjectId(query.classId);
      filter.classId = new Types.ObjectId(query.classId);
    }
  } else if (viewer.role === "student") {
    // Class derived from the authenticated record — query classId never trusted.
    const me = await User.findById(viewer.id).select("classId");
    if (!me?.classId) return [];
    filter.classId = me.classId;
  } else {
    if (query.classId) {
      assertObjectId(query.classId);
      filter.classId = new Types.ObjectId(query.classId);
    }
    if (query.teacherId) {
      assertObjectId(query.teacherId);
      filter.teacherId = new Types.ObjectId(query.teacherId);
    }
  }
  if (query.day) {
    const day = query.day.trim();
    if (!(DAYS as readonly string[]).includes(day)) throw ApiError.badRequest("Invalid day. Use Mon|Tue|Wed|Thu|Fri|Sat");
    filter.day = day;
  }
  const rows = await Timetable.find(filter).sort({ day: 1, startTime: 1 });
  return payloadize(rows);
}

// ---------------------------------------------------------------------------
// TODAY SCHEDULE — teacher only. LIVE → UPCOMING → DONE, chronological inside.
// ---------------------------------------------------------------------------
export async function todaySchedule(
  teacherId: string,
  instituteId: string,
  query: { date?: string; now?: string },
) {
  const date = query.date ?? todayISO();
  const now = query.now ?? nowHM();
  const day = weekdayOf(date);

  const rows = await Timetable.find({
    instituteId: new Types.ObjectId(instituteId),
    teacherId: new Types.ObjectId(teacherId),
    day,
    active: true,
  }).sort({ startTime: 1 });

  const stateOf = (t: TimetableDoc): SlotState =>
    toMinutes(now) >= toMinutes(t.startTime) && toMinutes(now) < toMinutes(t.endTime)
      ? "LIVE"
      : toMinutes(now) < toMinutes(t.startTime)
        ? "UPCOMING"
        : "DONE";
  const rank: Record<SlotState, number> = { LIVE: 0, UPCOMING: 1, DONE: 2 };
  const data = (await payloadize(rows, stateOf)).sort(
    (a, b) => rank[a.state as SlotState] - rank[b.state as SlotState] || toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  return { date, day, now, data };
}

// ---------------------------------------------------------------------------
// UPDATE — admin only. Re-runs clash excluding self; ownership immutable.
// ---------------------------------------------------------------------------
export interface UpdateTimetableInput {
  classId?: string;
  subject?: string;
  teacherId?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  type?: "regular" | "extra" | "cancelled";
}

export async function updateTimetable(adminId: string, instituteId: string, slotId: string, input: UpdateTimetableInput) {
  assertObjectId(slotId);
  const slot = await Timetable.findById(slotId);
  if (!slot) throw ApiError.notFound("Timetable not found");
  if (String(slot.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (!slot.active) throw ApiError.notFound("Timetable not found");

  if (input.classId !== undefined) {
    slot.classId = (await requireClassInInstitute(input.classId, instituteId))._id as never;
  }
  if (input.teacherId !== undefined) {
    slot.teacherId = (await requireTeacherInInstitute(input.teacherId, instituteId))._id as never;
  }
  if (input.day !== undefined) slot.day = input.day as TimetableDoc["day"];
  if (input.subject !== undefined) slot.subject = input.subject.trim();
  if (input.startTime !== undefined) slot.startTime = input.startTime;
  if (input.endTime !== undefined) slot.endTime = input.endTime;
  if (input.room !== undefined) slot.room = input.room.trim();
  if (input.type !== undefined) slot.type = input.type;
  if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
    throw ApiError.badRequest("endTime must be later than startTime");
  }

  await assertNoClash(
    instituteId,
    slot.teacherId as Types.ObjectId,
    slot.day,
    slot.startTime,
    slot.endTime,
    slot._id as Types.ObjectId,
  );
  await slot.save();
  await AuditLog.create({ by: adminId, instituteId, action: "timetable.updated" });
  return (await payloadize([slot]))[0];
}

// ---------------------------------------------------------------------------
// DELETE — admin only, soft (active=false).
// ---------------------------------------------------------------------------
export async function deleteTimetable(adminId: string, instituteId: string, slotId: string) {
  assertObjectId(slotId);
  const slot = await Timetable.findById(slotId);
  if (!slot || !slot.active) throw ApiError.notFound("Timetable not found");
  if (String(slot.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");

  slot.active = false;
  await slot.save();
  await AuditLog.create({ by: adminId, instituteId, action: "timetable.deleted" });
  return { id: String(slot._id), active: false };
}
