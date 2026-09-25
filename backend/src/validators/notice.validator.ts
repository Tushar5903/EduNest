import { z } from "zod";

/**
 * POST /api/teacher/class-info — class-scoped extra/cancelled announcement.
 * Ownership comes from req.user + Class.teacherId, never the body.
 */
export const classInfoValidator = z
  .object({
    classId: z.string().trim().min(1, "classId required"),
    title: z.string().trim().min(2, "title required"),
    body: z.string().trim().min(1, "body required"),
    type: z.enum(["extra", "cancelled"]),
  })
  .strict();
