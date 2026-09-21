import { Types } from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { Class, type ClassDoc } from "../models/Class.js";
import { Institute } from "../models/Institute.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { parsePagination } from "../utils/pagination.js";
import { escapeRegExpValue, requireClassInInstitute } from "../utils/scope.js";

export interface ClassPayload {
  id: string;
  name: string;
  section?: string;
  standard?: number;
  teacherId: string | null;
  academicYear: string;
  order: number;
  active: boolean;
  studentCount: number;
}

export function toClassPayload(c: ClassDoc, studentCount = 0): ClassPayload {
  return {
    id: String(c._id),
    name: c.name,
    section: c.section,
    standard: c.standard,
    teacherId: c.teacherId ? String(c.teacherId) : null,
    academicYear: c.academicYear,
    order: c.order,
    active: c.active,
    studentCount,
  };
}

async function studentCount(instituteId: string, classId: Types.ObjectId): Promise<number> {
  return User.countDocuments({
    instituteId: new Types.ObjectId(instituteId),
    classId,
    role: "student",
    active: true,
  });
}

// ---------------------------------------------------------------------------
// CREATE CLASS — instituteId from auth only; teacher must be same-institute.
// ---------------------------------------------------------------------------
export interface CreateClassInput {
  name: string;
  section?: string;
  standard?: number;
  teacherId?: string;
  academicYear: string;
  order: number;
}

export async function createClass(adminId: string, instituteId: string, input: CreateClassInput) {
  let teacherObjectId: Types.ObjectId | null = null;
  if (input.teacherId) {
    if (!Types.ObjectId.isValid(input.teacherId)) throw ApiError.badRequest("Invalid id format");
    const teacher = await User.findById(input.teacherId);
    if (!teacher) throw ApiError.notFound("Teacher not found");
    if (!teacher.instituteId || String(teacher.instituteId) !== instituteId) {
      throw ApiError.forbidden("Cross-institute access denied");
    }
    if (teacher.role !== "teacher") throw ApiError.badRequest("Assigned user must be a teacher");
    if (!teacher.active || teacher.status !== "active") throw ApiError.badRequest("Teacher must be active to take a class");
    teacherObjectId = teacher._id as Types.ObjectId;
  }

  // Exact-duplicate guard (model index is non-unique, so enforce 409 here).
  const clash = await Class.findOne({
    instituteId: new Types.ObjectId(instituteId),
    academicYear: input.academicYear.trim(),
    name: input.name.trim(),
    section: input.section?.trim() ?? { $exists: false },
    active: true,
  });
  if (clash) throw ApiError.conflict("Class already exists for this academic year");

  const klass = await Class.create({
    instituteId: new Types.ObjectId(instituteId),
    name: input.name.trim(),
    section: input.section?.trim(),
    standard: input.standard,
    teacherId: teacherObjectId,
    academicYear: input.academicYear.trim(),
    order: input.order,
  });
  await AuditLog.create({ by: adminId, instituteId, action: "class.created" });
  return toClassPayload(klass, 0);
}

// ---------------------------------------------------------------------------
// LIST CLASSES — admin sees all; teacher sees own only (enforced by caller).
// ---------------------------------------------------------------------------
export interface ListClassesQuery {
  academicYear?: string;
  teacherId?: string;
  page?: unknown;
  limit?: unknown;
}

export async function listClasses(
  instituteId: string,
  query: ListClassesQuery,
  viewer: { role: string; id: string },
) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, unknown> = {
    instituteId: new Types.ObjectId(instituteId),
    active: true,
  };
  if (viewer.role === "teacher") {
    filter.teacherId = new Types.ObjectId(viewer.id);
  } else if (query.teacherId) {
    if (!Types.ObjectId.isValid(query.teacherId)) throw ApiError.badRequest("Invalid id format");
    filter.teacherId = new Types.ObjectId(query.teacherId);
  }
  if (query.academicYear) {
    filter.academicYear = new RegExp(`^${escapeRegExpValue(query.academicYear.trim())}$`, "i");
  }
  const [total, rows] = await Promise.all([
    Class.countDocuments(filter),
    Class.find(filter).sort({ order: 1, name: 1 }).skip(skip).limit(limit),
  ]);
  const counts = await Promise.all(rows.map((c) => studentCount(instituteId, c._id as Types.ObjectId)));
  return { data: rows.map((c, i) => toClassPayload(c, counts[i])), page, total };
}

// ---------------------------------------------------------------------------
// GET CLASS — admin any; teacher owner-only; student own-class-only.
// ---------------------------------------------------------------------------
export async function getClass(instituteId: string, classId: string, viewer: { role: string; id: string }) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (!klass.active) throw ApiError.notFound("Class not found");

  if (viewer.role === "teacher" && String(klass.teacherId ?? "") !== viewer.id) {
    throw ApiError.forbidden("Forbidden for this class");
  }
  if (viewer.role === "student") {
    const me = await User.findById(viewer.id).select("classId");
    if (!me || !me.classId || String(me.classId) !== String(klass._id)) {
      throw ApiError.forbidden("Forbidden for this class");
    }
  }
  return toClassPayload(klass, await studentCount(instituteId, klass._id as Types.ObjectId));
}

// ---------------------------------------------------------------------------
// UPDATE CLASS — mutable fields only; ownership immutable.
// ---------------------------------------------------------------------------
export interface UpdateClassInput {
  name?: string;
  section?: string;
  standard?: number;
  teacherId?: string | null;
  academicYear?: string;
  order?: number;
}

export async function updateClass(adminId: string, instituteId: string, classId: string, input: UpdateClassInput) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (!klass.active) throw ApiError.notFound("Class not found");

  if (input.teacherId !== undefined) {
    if (input.teacherId === null || input.teacherId === "") {
      klass.teacherId = null as never;
    } else {
      if (!Types.ObjectId.isValid(input.teacherId)) throw ApiError.badRequest("Invalid id format");
      const teacher = await User.findById(input.teacherId);
      if (!teacher) throw ApiError.notFound("Teacher not found");
      if (!teacher.instituteId || String(teacher.instituteId) !== instituteId) {
        throw ApiError.forbidden("Cross-institute access denied");
      }
      if (teacher.role !== "teacher") throw ApiError.badRequest("Assigned user must be a teacher");
      if (!teacher.active || teacher.status !== "active") throw ApiError.badRequest("Teacher must be active to take a class");
      klass.teacherId = teacher._id as never;
    }
  }
  if (input.name !== undefined) klass.name = input.name.trim();
  if (input.section !== undefined) klass.section = input.section.trim();
  if (input.standard !== undefined) klass.standard = input.standard;
  if (input.academicYear !== undefined) klass.academicYear = input.academicYear.trim();
  if (input.order !== undefined) klass.order = input.order;
  await klass.save();

  await AuditLog.create({ by: adminId, instituteId, action: "class.updated" });
  return toClassPayload(klass, await studentCount(instituteId, klass._id as Types.ObjectId));
}

// ---------------------------------------------------------------------------
// DELETE CLASS — soft only; blocked while students remain → 400.
// ---------------------------------------------------------------------------
export async function deleteClass(adminId: string, instituteId: string, classId: string) {
  const klass = await requireClassInInstitute(classId, instituteId);
  if (!klass.active) throw ApiError.notFound("Class not found");

  const remaining = await studentCount(instituteId, klass._id as Types.ObjectId);
  if (remaining > 0) {
    throw ApiError.badRequest("Move or remove students before deleting this class.");
  }
  klass.active = false;
  await klass.save();
  await AuditLog.create({ by: adminId, instituteId, action: "class.deleted" });
  return { id: String(klass._id), active: false };
}

// ---------------------------------------------------------------------------
// TERMINAL CLASS — last standard of the school (promotion cap, Phase 6+).
// ---------------------------------------------------------------------------
export async function setTerminalClass(adminId: string, instituteId: string, terminalClassId: string) {
  const klass = await requireClassInInstitute(terminalClassId, instituteId);
  if (!klass.active) throw ApiError.badRequest("Terminal class must be an active class");

  const institute = await Institute.findById(instituteId);
  if (!institute) throw ApiError.notFound("Institute not found");
  institute.settings = { ...institute.settings, terminalClassId: klass._id as never };
  await institute.save();
  await AuditLog.create({ by: adminId, instituteId, action: "terminal-class.set" });
  return { instituteId, terminalClassId: String(klass._id) };
}
