import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Attendance } from "../models/Attendance.js";
import { Class } from "../models/Class.js";
import { Fee } from "../models/Fee.js";
import { Notice } from "../models/Notice.js";
import { Result } from "../models/Result.js";
import { Test, TestMark } from "../models/Test.js";
import { User } from "../models/User.js";
import { toClassPayload } from "./class.service.js";
import { createStudent, sanitizeUser, type CreateStudentInput } from "./user.service.js";
import { ApiError } from "../utils/errors.js";
import { requireClassInInstitute } from "../utils/scope.js";

/**
 * Teacher-owned class guard: exists elsewhere → 403, missing/inactive → 404,
 * owned by another teacher → 403. Ownership is Class.teacherId === teacher id.
 */
async function requireOwnedClass(classId: string, teacherId: string, instituteId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (!klass.active) throw ApiError.notFound("Class not found");
  if (String(klass.teacherId ?? "") !== teacherId) {
    throw ApiError.forbidden("Forbidden for this class");
  }
  return klass;
}

// ---------------------------------------------------------------------------
// 1. My classes — active classes assigned to this teacher, institute-scoped.
// ---------------------------------------------------------------------------
export async function myClasses(teacherId: string, instituteId: string) {
  const rows = await Class.find({
    teacherId: new Types.ObjectId(teacherId),
    instituteId: new Types.ObjectId(instituteId),
    active: true,
  }).sort({ order: 1, name: 1 });
  const counts = await Promise.all(
    rows.map((c) =>
      User.countDocuments({ instituteId: new Types.ObjectId(instituteId), classId: c._id, role: "student", active: true }),
    ),
  );
  return rows.map((c, i) => toClassPayload(c, counts[i]));
}

// ---------------------------------------------------------------------------
// 2. Class dashboard — total + gender counts + rollNo-sorted roster.
//    Attendance is calculated from saved class-period-day records. Performance
//    is calculated from published Result rows, with TestMark as a fallback for
//    assessments whose marks have been entered but not published yet.
// ---------------------------------------------------------------------------
export interface DashboardRosterItem {
  id: string;
  rollNo?: number;
  name: string;
  loginId?: string;
  gender?: string;
  feeStatus: string | null;
  performancePercent: number;
  attendancePercent: number;
}

export interface DashboardSummary {
  averagePercent: number;
  studentsWithData: number;
}

export async function classDashboard(teacherId: string, instituteId: string, classId: string) {
  const klass = await requireOwnedClass(classId, teacherId, instituteId);

  const students = await User.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    role: "student",
    active: true,
  }).sort({ rollNo: 1, name: 1 });

  const studentIds = students.map((student) => student._id as Types.ObjectId);
  const [attendanceRows, resultRows, feeRows, tests] = await Promise.all([
    Attendance.find({ instituteId: new Types.ObjectId(instituteId), classId: klass._id }).select("records").lean(),
    Result.find({ instituteId: new Types.ObjectId(instituteId), classId: klass._id, studentId: { $in: studentIds } }).select("studentId subjects").lean(),
    Fee.find({ instituteId: new Types.ObjectId(instituteId), studentId: { $in: studentIds } }).select("studentId status").sort({ updatedAt: -1 }).lean(),
    Test.find({ instituteId: new Types.ObjectId(instituteId), classId: klass._id }).select("_id maxMarks").lean(),
  ]);

  const testIds = tests.map((test) => test._id);
  const markRows = testIds.length
    ? await TestMark.find({ instituteId: new Types.ObjectId(instituteId), testId: { $in: testIds }, studentId: { $in: studentIds } }).select("testId studentId marks").lean()
    : [];

  const attendanceByStudent = new Map<string, { present: number; attended: number }>();
  for (const row of attendanceRows) {
    for (const record of row.records) {
      const key = String(record.studentId);
      const current = attendanceByStudent.get(key) ?? { present: 0, attended: 0 };
      // Leave is intentionally excluded from both numerator and denominator.
      if (record.status === "present") { current.present += 1; current.attended += 1; }
      else if (record.status === "absent") current.attended += 1;
      attendanceByStudent.set(key, current);
    }
  }

  const performanceByStudent = new Map<string, { marks: number; max: number }>();
  for (const row of resultRows) {
    const current = performanceByStudent.get(String(row.studentId)) ?? { marks: 0, max: 0 };
    for (const subject of row.subjects ?? []) { current.marks += subject.marks; current.max += subject.max; }
    performanceByStudent.set(String(row.studentId), current);
  }
  // A teacher may have saved marks before publishing a Result. Use those marks
  // as the visible performance until a published Result exists for that student.
  const publishedStudents = new Set(resultRows.map((row) => String(row.studentId)));
  const maxByTest = new Map(tests.map((test) => [String(test._id), test.maxMarks]));
  for (const row of markRows) {
    const studentKey = String(row.studentId);
    if (publishedStudents.has(studentKey)) continue;
    const current = performanceByStudent.get(studentKey) ?? { marks: 0, max: 0 };
    current.marks += row.marks;
    current.max += maxByTest.get(String(row.testId)) ?? 0;
    performanceByStudent.set(studentKey, current);
  }

  const feePriority = ["overdue", "pending", "submitted", "collected", "paid"];
  const feeByStudent = new Map<string, string>();
  for (const row of feeRows) {
    const key = String(row.studentId);
    const current = feeByStudent.get(key);
    if (!current || feePriority.indexOf(row.status) < feePriority.indexOf(current)) feeByStudent.set(key, row.status);
  }

  const genderCounts = { M: 0, F: 0, O: 0 };
  for (const s of students) {
    if (s.gender === "M" || s.gender === "F" || s.gender === "O") genderCounts[s.gender] += 1;
    // Missing/unknown gender is simply uncounted — never a crash.
  }

  const roster: DashboardRosterItem[] = students.map((s) => {
    const attendance = attendanceByStudent.get(String(s._id));
    const performance = performanceByStudent.get(String(s._id));
    return {
      ...sanitizeUser(s),
      feeStatus: feeByStudent.get(String(s._id)) ?? null,
      attendancePercent: attendance?.attended ? Math.round((attendance.present / attendance.attended) * 100) : 0,
      performancePercent: performance?.max ? Math.round((performance.marks / performance.max) * 100) : 0,
    };
  });
  const attendanceValues = roster.map((student) => student.attendancePercent).filter((value) => value > 0);
  const performanceValues = roster.map((student) => student.performancePercent).filter((value) => value > 0);
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const attendanceSummary: DashboardSummary = { averagePercent: average(attendanceValues), studentsWithData: attendanceValues.length };
  const performanceSummary: DashboardSummary = { averagePercent: average(performanceValues), studentsWithData: performanceValues.length };
  return { classId: String(klass._id), total: students.length, genderCounts, attendanceSummary, performanceSummary, roster };
}

// ---------------------------------------------------------------------------
// 3. Create student in own class — ownership first, then Phase 4 creation.
//    S-XXXX / temp credential / rollNo / AuditLog all reused, actor = teacher.
// ---------------------------------------------------------------------------
export async function createStudentInOwnClass(teacherId: string, instituteId: string, input: CreateStudentInput) {
  const klass = await requireClassInInstitute(input.classId!, instituteId);
  if (!klass.active) throw ApiError.badRequest("Class is no longer active");
  if (String(klass.teacherId ?? "") !== teacherId) {
    throw ApiError.forbidden("You can only add students to your own classes");
  }
  return createStudent(teacherId, instituteId, input);
}

// ---------------------------------------------------------------------------
// 4. Class info — extra/cancelled announcement for the teacher's own class.
// ---------------------------------------------------------------------------
export interface ClassInfoInput {
  classId: string;
  title: string;
  body: string;
  type: "extra" | "cancelled";
}

export async function postClassInfo(teacherId: string, instituteId: string, input: ClassInfoInput) {
  const klass = await requireOwnedClass(input.classId, teacherId, instituteId);
  const notice = await Notice.create({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    title: input.title.trim(),
    body: input.body.trim(),
    audience: "class",
    type: input.type,
    createdBy: new Types.ObjectId(teacherId),
  });
  await AuditLog.create({ by: teacherId, instituteId, action: "class-info.posted" });
  return {
    id: String(notice._id),
    classId: String(klass._id),
    title: notice.title,
    body: notice.body,
    type: notice.type,
  };
}
