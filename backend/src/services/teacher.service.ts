import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Class } from "../models/Class.js";
import { Notice } from "../models/Notice.js";
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
//    fee/performance/attendance are stubs (0/null) until those phases land.
// ---------------------------------------------------------------------------
export interface DashboardRosterItem {
  id: string;
  rollNo?: number;
  name: string;
  loginId?: string;
  gender?: string;
  feeStatus: null;
  performancePercent: number;
  attendancePercent: number;
}

export async function classDashboard(teacherId: string, instituteId: string, classId: string) {
  const klass = await requireOwnedClass(classId, teacherId, instituteId);

  const students = await User.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    role: "student",
    active: true,
  }).sort({ rollNo: 1, name: 1 });

  const genderCounts = { M: 0, F: 0, O: 0 };
  for (const s of students) {
    if (s.gender === "M" || s.gender === "F" || s.gender === "O") genderCounts[s.gender] += 1;
    // Missing/unknown gender is simply uncounted — never a crash.
  }

  const roster: DashboardRosterItem[] = students.map((s) => ({
    ...sanitizeUser(s),
    attendancePercent: 0,
  }));
  return { classId: String(klass._id), total: students.length, genderCounts, roster };
}

// ---------------------------------------------------------------------------
// 3. Create student in own class — ownership first, then Phase 4 creation.
//    S-XXXX / temp credential / rollNo / AuditLog all reused, actor = teacher.
// ---------------------------------------------------------------------------
export async function createStudentInOwnClass(teacherId: string, instituteId: string, input: CreateStudentInput) {
  const klass = await requireClassInInstitute(input.classId, instituteId);
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
