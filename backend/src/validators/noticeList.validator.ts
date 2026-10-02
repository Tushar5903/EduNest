import { z } from "zod";

/** GET /api/notices — scoped feed. Student gets all+student+own-class server-side. */
export const listNoticesQueryValidator = z.object({
  audience: z.enum(["all", "student", "teacher", "class"]).optional(),
  classId: z.string().trim().optional(),
  limit: z.string().trim().optional(),
  page: z.string().trim().optional(),
});

/** POST /api/notices — admin (any audience) / teacher (class-only, enforced in service). */
export const createNoticeValidator = z
  .object({
    title: z.string().trim().min(2, "title required").max(200),
    body: z.string().trim().min(1, "body required").max(5000),
    audience: z.enum(["all", "student", "teacher", "class"]),
    classId: z.string().trim().min(1).optional(),
    classIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

/** PATCH /api/notices/:id — edit own posts (admin any / teacher own class posts). */
export const updateNoticeValidator = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
    audience: z.enum(["all", "student", "teacher", "class"]).optional(),
    classIds: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();
