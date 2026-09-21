import { z } from "zod";

const gender = z.enum(["M", "F", "O"]);

/** POST /api/admin/teachers — name + subject required. role/instituteId/loginId never accepted. */
export const createTeacherValidator = z
  .object({
    name: z.string().trim().min(2, "name required"),
    subject: z.string().trim().min(1, "subject required"),
    phone: z.string().trim().optional(),
    gender: gender.optional(),
    salaryAmount: z.number().min(0).optional(),
  })
  .strict();

/** POST /api/admin/students — name + classId required. */
export const createStudentValidator = z
  .object({
    name: z.string().trim().min(2, "name required"),
    classId: z.string().trim().min(1, "classId required"),
    gender: gender.optional(),
  })
  .strict();

/**
 * PATCH /api/admin/users/:id — mutable fields only.
 * Immutable loginId/role/instituteId are deliberately ACCEPTED here so the
 * service can reject them with 403 (spec) instead of zod's generic 400.
 */
export const updateUserValidator = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().optional(),
  gender: gender.optional(),
  subject: z.string().trim().min(1).optional(),
  salaryAmount: z.number().min(0).optional(),
  loginId: z.string().trim().optional(),
  role: z.string().trim().optional(),
  instituteId: z.string().trim().optional(),
});

/** PATCH /api/admin/students/:id/reassign */
export const reassignStudentValidator = z
  .object({
    classId: z.string().trim().min(1, "classId required"),
  })
  .strict();

/** PATCH /api/admin/classes/:id/teacher */
export const assignClassTeacherValidator = z
  .object({
    teacherId: z.string().trim().min(1, "teacherId required"),
  })
  .strict();

const LIST_STATUSES = ["pending", "active", "suspended", "rejected"] as const;

/** Shared ?search&status&page&limit for teacher/student lists. */
export const listUsersQueryValidator = z.object({
  search: z.string().trim().optional(),
  status: z.enum(LIST_STATUSES).optional(),
  classId: z.string().trim().optional(),
  page: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});
