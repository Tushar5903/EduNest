import { Types } from "mongoose";
import { Class } from "../models/Class.js";
import { Timetable } from "../models/Timetable.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { todayISO } from "../utils/date.js";
import { myAttendance } from "./attendance.service.js";
import { myFees } from "./fee.service.js";
import { myResults } from "./test.service.js";
import { listNotices } from "./notice.service.js";

/** Own profile + class history (v1: current class only; history = current enrollment). */
export async function myProfile(studentId: string, instituteId: string) {
  const me = await User.findById(studentId);
  if (!me || me.role !== "student") throw ApiError.notFound("Student not found");
  if (!me.instituteId || String(me.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  let klass: { id: string; name: string; section?: string } | null = null;
  if (me.classId) {
    const c = await Class.findById(me.classId).select("name section standard academicYear").lean();
    if (c) klass = { id: String(c._id), name: c.name, section: c.section };
  }
  return {
    id: String(me._id),
    name: me.name,
    loginId: me.loginId,
    classId: me.classId ? String(me.classId) : null,
    class: klass,
    rollNo: me.rollNo,
    gender: me.gender,
    status: me.status,
    classHistory: klass ? [klass] : [],
  };
}

/** Own-class teachers: class teacher + timetable teachers. No contact info. */
export async function myTeachers(studentId: string, instituteId: string) {
  const me = await User.findById(studentId).select("classId");
  if (!me?.classId) return [];
  const klass = await Class.findById(me.classId).select("teacherId name section").lean();
  const slots = await Timetable.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: me.classId,
    active: true,
  }).lean();
  const byTeacher = new Map<string, { subjects: Set<string> }>();
  for (const s of slots) {
    const id = String(s.teacherId);
    if (!byTeacher.has(id)) byTeacher.set(id, { subjects: new Set() });
    byTeacher.get(id)!.subjects.add(s.subject);
  }
  if (klass?.teacherId) {
    const id = String(klass.teacherId);
    if (!byTeacher.has(id)) byTeacher.set(id, { subjects: new Set() });
  }
  if (byTeacher.size === 0) return [];
  const teachers = await User.find({ _id: { $in: [...byTeacher.keys()] }, role: "teacher", active: true })
    .select("loginId name subject")
    .lean();
  const classLabel = klass ? `${klass.name}${klass.section ? ` ${klass.section}` : ""}` : "";
  return teachers.map((t) => ({
    id: String(t._id),
    loginId: t.loginId,
    name: t.name,
    subject: [...byTeacher.get(String(t._id))!.subjects].join(", ") || t.subject || "",
    class: classLabel,
  }));
}

/** Own-class weekly timetable + extra/cancelled overrides. Monday-start week. */
export async function myTimetable(studentId: string, instituteId: string, week?: string) {
  const me = await User.findById(studentId).select("classId");
  if (!me?.classId) return { week: week ?? todayISO(), days: {}, overrides: [] };
  const { Notice } = await import("../models/Notice.js");
  const slots = await Timetable.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: me.classId,
    active: true,
  })
    .sort({ startTime: 1 })
    .lean();
  const teacherIds = [...new Set(slots.map((s) => String(s.teacherId)))];
  const teachers = teacherIds.length ? await User.find({ _id: { $in: teacherIds } }).select("name").lean() : [];
  const nameById = new Map(teachers.map((t) => [String(t._id), t.name]));
  const days: Record<string, { subject: string; teacher: string; startTime: string; endTime: string; room?: string; type: string }[]> = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [],
  };
  for (const s of slots) {
    if (!days[s.day]) continue;
    days[s.day].push({
      subject: s.subject,
      teacher: nameById.get(String(s.teacherId)) ?? "",
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      type: s.type,
    });
  }
  const overrides = await Notice.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: me.classId,
    audience: "class",
    type: { $in: ["extra", "cancelled"] },
    active: true,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  return {
    week: week ?? todayISO(),
    classId: String(me.classId),
    days,
    overrides: overrides.map((o) => ({ id: String(o._id), title: o.title, body: o.body, type: o.type, createdAt: o.createdAt })),
  };
}

/** Dashboard composition from safe self-scoped services (no extra endpoint needed). */
export async function myDashboard(studentId: string, instituteId: string) {
  const [profile, attendance, fees, notices, results] = await Promise.all([
    myProfile(studentId, instituteId),
    myAttendance(studentId, instituteId, todayISO().slice(0, 7)),
    myFees(studentId, instituteId),
    listNotices(instituteId, { limit: "3" }, { role: "student", id: studentId }),
    myResults(studentId, instituteId),
  ]);
  const timetable = await myTimetable(studentId, instituteId);
  return {
    profile,
    attendancePercent: attendance.percent,
    feeDue: fees.due,
    latestNotices: notices.data.slice(0, 3),
    todayOverrides: timetable.overrides,
    resultsPercent: results.data[0]?.percent ?? 0,
  };
}
