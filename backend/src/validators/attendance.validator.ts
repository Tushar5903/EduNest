import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const yyyymmdd = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

/** POST /api/attendance — markedBy comes from req.user, never the body. */
export const markAttendanceValidator = z
  .object({
    classId: objectIdLike,
    date: yyyymmdd,
    periodId: objectIdLike,
    records: z
      .array(
        z
          .object({
            studentId: objectIdLike,
            status: z.enum(["present", "absent"]),
          })
          .strict(),
      )
      .min(1, "at least one record required"),
  })
  .strict();

/** PATCH /api/attendance/:id — same record shape, full replacement. */
export const updateAttendanceValidator = z
  .object({
    records: z
      .array(
        z
          .object({
            studentId: objectIdLike,
            status: z.enum(["present", "absent"]),
          })
          .strict(),
      )
      .min(1, "at least one record required"),
  })
  .strict();

/** GET /api/attendance — filters only; student identity forced server-side. */
export const listAttendanceQueryValidator = z.object({
  classId: z.string().trim().optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
    .optional(),
  studentId: z.string().trim().optional(),
});

/** GET /api/students/me/attendance — month window only. */
export const myAttendanceQueryValidator = z.object({
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM")
    .optional(),
});
