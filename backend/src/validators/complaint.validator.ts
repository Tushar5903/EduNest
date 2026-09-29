import { z } from "zod";

const objectIdLike = z.string().trim().min(1);

/**
 * POST /api/complaints — recipient semantics locked:
 * - toType teacher requires toTeacherId (must be one of My Teachers, enforced in service)
 * - toType admin forbids toTeacherId (teacher never sees admin-against-self rows)
 * Category + optional target (classmate or teacher) + subject/body.
 */
export const createComplaintValidator = z
  .object({
    toType: z.enum(["teacher", "admin"]),
    toTeacherId: objectIdLike.optional(),
    category: z.enum(["against-student", "against-teacher", "other"]),
    targetStudentId: objectIdLike.optional(),
    targetTeacherId: objectIdLike.optional(),
    subject: z.string().trim().min(3, "subject required").max(200),
    body: z.string().trim().min(10, "please describe the issue (min 10 chars)").max(5000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.toType === "teacher" && !v.toTeacherId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "toTeacherId required for teacher complaints", path: ["toTeacherId"] });
    }
    if (v.toType === "admin" && v.toTeacherId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "toTeacherId must be omitted for admin complaints", path: ["toTeacherId"] });
    }
  });

/** PATCH /api/complaints/:id — moderation (teacher own-inbox / admin any). No student route uses this. */
export const updateComplaintValidator = z
  .object({
    status: z.enum(["in-review", "resolved", "rejected", "escalated"]),
    reply: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
