import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const yyyymmdd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD");

/** POST /api/fees — admin only. Student self-service never creates fees. */
export const createFeeValidator = z
  .object({
    studentId: objectIdLike,
    amount: z.number().min(0),
    dueDate: yyyymmdd,
    head: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

/** GET /api/fees — admin/teacher filters; student identity forced server-side. */
export const listFeesQueryValidator = z.object({
  classId: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
  status: z.enum(["pending", "submitted", "collected", "paid", "overdue"]).optional(),
});

/** PATCH /api/fees/:id — admin: amount/due edits + mark paid. Manual status is paid-only; overdue is auto-only. */
export const updateFeeValidator = z
  .object({
    amount: z.number().min(0).optional(),
    dueDate: yyyymmdd.optional(),
    status: z.enum(["paid"]).optional(),
  })
  .strict();

/** PATCH /api/teacher/fees/:id/status — limited: any unpaid -> paid + remark only. */
export const teacherFeeStatusValidator = z
  .object({
    status: z.enum(["paid"]),
    remark: z.string().trim().max(500).optional(),
  })
  .strict();
