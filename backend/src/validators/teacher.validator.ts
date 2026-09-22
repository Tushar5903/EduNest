import { z } from "zod";

/**
 * POST /api/teacher/students — own class only.
 * Strict: teacherId/instituteId/role/loginId/password etc. are rejected
 * (400 via validateBody) — ownership comes from req.user, never the body.
 */
export const teacherCreateStudentValidator = z
  .object({
    name: z.string().trim().min(2, "name required"),
    classId: z.string().trim().min(1, "classId required"),
    gender: z.enum(["M", "F", "O"]).optional(),
    // Optional profile field only (freely shared, never a login).
    phone: z.string().trim().optional(),
  })
  .strict();
