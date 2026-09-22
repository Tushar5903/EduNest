import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Class } from "../models/Class.js";
import { User, type UserDoc } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { generateLoginId, generateReferenceId, generateStudentId, nextRollNo } from "../utils/idGenerator.js";
import { parsePagination } from "../utils/pagination.js";
import { hashSecret } from "../utils/password.js";
import { normalizePhone } from "../utils/phone.js";
import { assertObjectId, escapeRegExpValue, requireClassInInstitute, requireUserInInstitute } from "../utils/scope.js";

interface SanitizedUser {
  id: string;
  name: string;
  email?: string;
  loginId?: string;
  role: string;
  instituteId: string | null;
  classId: string | null;
  rollNo?: number;
  gender?: string;
  subject?: string;
  phone?: string;
  salaryAmount?: number;
  status: string;
  active: boolean;
  // Stubs until Fees / Tests phases wire real aggregates (never fake values).
  feeStatus: null;
  performancePercent: number;
}

/** Strip hashes/credentials. tempPassword is ONLY ever returned by create/reset. */
export function sanitizeUser(u: UserDoc): SanitizedUser {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    loginId: u.loginId,
    role: u.role,
    instituteId: u.instituteId ? String(u.instituteId) : null,
    classId: u.classId ? String(u.classId) : null,
    rollNo: u.rollNo,
    gender: u.gender,
    subject: u.subject,
    phone: u.phone,
    salaryAmount: u.salaryAmount,
    status: u.status,
    active: u.active,
    feeStatus: null,
    performancePercent: 0,
  };
}

// ---------------------------------------------------------------------------
// A. Create teacher — auto T-XXXX + required unique phone + one-time temp.
// ---------------------------------------------------------------------------
export interface CreateTeacherInput {
  name: string;
  subject: string;
  phone: string;
  gender?: "M" | "F" | "O";
  salaryAmount?: number;
}

export async function createTeacher(adminId: string, instituteId: string, input: CreateTeacherInput) {
  const phone = normalizePhone(input.phone);
  const clash = await User.findOne({ phone, role: "teacher", active: true }).select("_id").lean();
  if (clash) throw ApiError.conflict("Phone already registered to another teacher");

  const loginId = await generateLoginId("teacher");
  const tempPassword = generateReferenceId();
  let teacher;
  try {
    teacher = await User.create({
      name: input.name.trim(),
      subject: input.subject.trim(),
      phone,
      gender: input.gender,
      salaryAmount: input.salaryAmount,
      loginId,
      passwordHash: await hashSecret(tempPassword),
      role: "teacher",
      instituteId: new Types.ObjectId(instituteId),
      status: "active",
    });
  } catch (err) {
    // Race backstop: unique phone index fired between check and insert.
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === 11000) {
      throw ApiError.conflict("Phone already registered to another teacher");
    }
    throw err;
  }
  await AuditLog.create({ by: adminId, instituteId, action: "teacher.created" });
  return { id: String(teacher._id), name: teacher.name, loginId, tempPassword, phone };
}

// ---------------------------------------------------------------------------
// B. Create student — auto 6-digit ID + rollNo = max(target class) + 1.
//    Phone is an optional shared profile field — never a login.
// ---------------------------------------------------------------------------
export interface CreateStudentInput {
  name: string;
  classId: string;
  gender?: "M" | "F" | "O";
  phone?: string;
}

export async function createStudent(adminId: string, instituteId: string, input: CreateStudentInput) {
  const klass = await requireClassInInstitute(input.classId, instituteId);
  if (!klass.active) throw ApiError.badRequest("Class is no longer active");

  const existing = await User.distinct("rollNo", {
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    role: "student",
    active: true,
    rollNo: { $type: "number" },
  });
  const rollNo = nextRollNo(existing as number[]);

  const loginId = await generateStudentId();
  const tempPassword = generateReferenceId();
  const student = await User.create({
    name: input.name.trim(),
    gender: input.gender,
    phone: input.phone ? normalizePhone(input.phone) : undefined,
    loginId,
    passwordHash: await hashSecret(tempPassword),
    role: "student",
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    rollNo,
    status: "active",
  });
  await AuditLog.create({ by: adminId, instituteId, action: "student.created" });
  return { id: String(student._id), name: student.name, loginId, tempPassword, rollNo, classId: String(klass._id) };
}

// ---------------------------------------------------------------------------
// C/D. Lists — own institute only, soft-deleted excluded.
// ---------------------------------------------------------------------------
export interface ListUsersQuery {
  search?: string;
  status?: string;
  classId?: string;
  page?: unknown;
  limit?: unknown;
}

const LIST_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

function statusFilter(status?: string): Record<string, unknown> {
  if (!status) return {};
  const s = status.trim().toLowerCase();
  if (!(LIST_STATUSES as readonly string[]).includes(s)) {
    throw ApiError.badRequest("Invalid status filter. Use pending|active|suspended|rejected");
  }
  return { status: s };
}

export async function listTeachers(instituteId: string, query: ListUsersQuery) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    role: "teacher",
    active: true,
    ...statusFilter(query.status),
  };
  const q = (query.search ?? "").trim();
  if (q) {
    const safe = escapeRegExpValue(q);
    filter.$or = [{ name: new RegExp(safe, "i") }, { subject: new RegExp(safe, "i") }, { loginId: new RegExp(safe, "i") }];
  }
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
  ]);
  return { data: rows.map(sanitizeUser), page, total };
}

export async function listStudents(instituteId: string, query: ListUsersQuery) {
  if (query.classId) {
    await requireClassInInstitute(query.classId, instituteId);
  }
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    role: "student",
    active: true,
    ...statusFilter(query.status),
  };
  if (query.classId) filter.classId = new Types.ObjectId(query.classId);
  const q = (query.search ?? "").trim();
  if (q) {
    const safe = escapeRegExpValue(q);
    filter.$or = [{ name: new RegExp(safe, "i") }, { loginId: new RegExp(safe, "i") }];
  }
  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ rollNo: 1, name: 1 }).skip(skip).limit(limit),
  ]);
  return { data: rows.map(sanitizeUser), page, total };
}

// ---------------------------------------------------------------------------
// E. Get user — own institute only + teacher delete-guard info.
// ---------------------------------------------------------------------------
export async function getUser(instituteId: string, userId: string) {
  const user = await requireUserInInstitute(userId, instituteId);
  if (!user.active) throw ApiError.notFound("User not found");
  const base = sanitizeUser(user);
  if (user.role !== "teacher") return base;
  const assigned = await Class.find({ teacherId: user._id, instituteId: user.instituteId, active: true })
    .select("name section academicYear")
    .lean();
  return {
    ...base,
    assignedClasses: assigned.map((c) => ({
      id: String(c._id),
      name: c.name,
      section: c.section,
      academicYear: c.academicYear,
    })),
    canDelete: assigned.length === 0,
  };
}

// ---------------------------------------------------------------------------
// F. Edit user — mutable fields only; immutable presence → 403.
// ---------------------------------------------------------------------------
export interface UpdateUserInput {
  name?: string;
  phone?: string;
  gender?: "M" | "F" | "O";
  subject?: string;
  salaryAmount?: number;
  loginId?: string;
  role?: string;
  instituteId?: string;
}

export async function updateUser(adminId: string, instituteId: string, userId: string, input: UpdateUserInput) {
  if (input.loginId !== undefined || input.role !== undefined || input.instituteId !== undefined) {
    throw ApiError.forbidden("loginId, role and instituteId are immutable");
  }
  const user = await requireUserInInstitute(userId, instituteId);
  if (!user.active) throw ApiError.notFound("User not found");

  if (input.name !== undefined) user.name = input.name.trim();
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    // Teachers keep the active-teacher uniqueness invariant on edit too.
    if (user.role === "teacher" && phone !== user.phone) {
      const clash = await User.findOne({ phone, role: "teacher", active: true, _id: { $ne: user._id } })
        .select("_id")
        .lean();
      if (clash) throw ApiError.conflict("Phone already registered to another teacher");
    }
    user.phone = phone;
  }
  if (input.gender !== undefined) user.gender = input.gender;
  if (input.subject !== undefined) user.subject = input.subject.trim();
  if (input.salaryAmount !== undefined) user.salaryAmount = input.salaryAmount;
  await user.save();

  await AuditLog.create({ by: adminId, instituteId, action: "user.updated" });
  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// G. Soft delete — active=false; teacher with classes → 400.
// ---------------------------------------------------------------------------
export async function softDeleteUser(adminId: string, instituteId: string, userId: string) {
  const user = await requireUserInInstitute(userId, instituteId);
  if (!user.active) throw ApiError.notFound("User not found");

  if (user.role === "teacher") {
    const assigned = await Class.countDocuments({ teacherId: user._id, instituteId: user.instituteId, active: true });
    if (assigned > 0) {
      throw ApiError.badRequest("Teacher must be reassigned from classes before deletion.");
    }
  }

  user.active = false;
  user.refreshTokenHash = undefined as never;
  await user.save();
  await AuditLog.create({ by: adminId, instituteId, action: "user.deleted" });
  return { id: String(user._id), active: false };
}

// ---------------------------------------------------------------------------
// H. Reset password — new one-time credential, old session revoked.
// ---------------------------------------------------------------------------
export async function resetPassword(adminId: string, instituteId: string, userId: string) {
  const user = await requireUserInInstitute(userId, instituteId);
  if (!user.active) throw ApiError.notFound("User not found");

  const tempPassword = generateReferenceId();
  user.passwordHash = await hashSecret(tempPassword);
  user.refreshTokenHash = undefined as never;
  await user.save();
  await AuditLog.create({ by: adminId, instituteId, action: "password.reset" });
  return { loginId: user.loginId ?? user.email ?? String(user._id), tempPassword };
}

// ---------------------------------------------------------------------------
// I. Remove student from class → pool (classId=null, rollNo unset, gap kept).
// ---------------------------------------------------------------------------
export async function removeStudentFromClass(adminId: string, instituteId: string, studentId: string) {
  const student = await requireUserInInstitute(studentId, instituteId);
  if (!student.active) throw ApiError.notFound("User not found");
  if (student.role !== "student") throw ApiError.badRequest("Only students can be removed from a class");

  // Unset rollNo: the (instituteId, classId, rollNo) partial-unique index covers
  // every doc carrying a numeric rollNo, so two pooled students would collide
  // on (institute, null, N). The roster gap in the old class is preserved.
  student.classId = null as never;
  student.rollNo = undefined as never;
  await student.save();
  await AuditLog.create({ by: adminId, instituteId, action: "student.removed-from-class" });
  return sanitizeUser(student);
}

// ---------------------------------------------------------------------------
// J. Reassign student — new rollNo = max(target) + 1, loginId preserved.
// ---------------------------------------------------------------------------
export async function reassignStudent(adminId: string, instituteId: string, studentId: string, targetClassId: string) {
  const student = await requireUserInInstitute(studentId, instituteId);
  if (!student.active) throw ApiError.notFound("User not found");
  if (student.role !== "student") throw ApiError.badRequest("Only students can be reassigned");

  const target = await requireClassInInstitute(targetClassId, instituteId);
  if (!target.active) throw ApiError.badRequest("Target class is no longer active");

  const existing = (await User.distinct("rollNo", {
    instituteId: new Types.ObjectId(instituteId),
    classId: target._id,
    role: "student",
    active: true,
    rollNo: { $type: "number" },
  })) as number[];

  student.classId = target._id as never;
  student.rollNo = nextRollNo(existing);
  await student.save();
  // Assignment trail reuses the append-only AuditLog (no duplicate log model).
  await AuditLog.create({ by: adminId, instituteId, action: "student.reassigned" });
  return sanitizeUser(student);
}

// ---------------------------------------------------------------------------
// K. Assign class teacher — same-institute, active teacher only.
// ---------------------------------------------------------------------------
export async function assignClassTeacher(adminId: string, instituteId: string, classId: string, teacherId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);

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

  klass.teacherId = teacher._id as never;
  await klass.save();
  await AuditLog.create({ by: adminId, instituteId, action: "class.teacher-assigned" });
  return { id: String(klass._id), teacherId: String(teacher._id) };
}

// ---------------------------------------------------------------------------
// L. Resequence roll numbers — the ONLY allowed reshuffle (alphabetical 1..N).
// ---------------------------------------------------------------------------
export async function resequenceRoll(adminId: string, instituteId: string, classId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);

  const students = await User.find({
    instituteId: new Types.ObjectId(instituteId),
    classId: klass._id,
    role: "student",
    active: true,
  }).sort({ name: 1 });
  // Deterministic alphabetical order (case-insensitive, stable _id tiebreak).
  students.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  // Two-phase write: unset first so intermediate values can never collide
  // on the (instituteId, classId, rollNo) partial-unique index.
  const ids = students.map((s) => s._id);
  if (ids.length > 0) {
    await User.updateMany({ _id: { $in: ids } }, { $unset: { rollNo: 1 } });
    await User.bulkWrite(students.map((s, i) => ({ updateOne: { filter: { _id: s._id }, update: { rollNo: i + 1 } } })));
  }
  await AuditLog.create({ by: adminId, instituteId, action: "roll.resequenced" });

  const rows = await User.find({ _id: { $in: ids } }).sort({ rollNo: 1 });
  return { classId: String(klass._id), roster: rows.map(sanitizeUser) };
}
