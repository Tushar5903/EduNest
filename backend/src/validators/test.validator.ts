import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const yyyymmdd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

/** POST /api/tests — teacher (own class) / admin. */
export const createTestValidator = z
  .object({
    classId: objectIdLike,
    subject: z.string().trim().min(1, "subject required").max(120),
    title: z.string().trim().min(2, "title required").max(200),
    date: yyyymmdd,
    maxMarks: z.number().min(1),
  })
  .strict();

/** GET /api/tests — filters only; student scoped to own class server-side. */
export const listTestsQueryValidator = z.object({
  classId: z.string().trim().optional(),
  subject: z.string().trim().optional(),
});

/** POST/PATCH /api/tests/:id/marks — row-wise entry, marks<=maxMarks enforced in service. */
export const testMarksValidator = z
  .object({
    marks: z
      .array(
        z
          .object({
            studentId: objectIdLike,
            marks: z.number().min(0),
          })
          .strict(),
      )
      .min(1, "at least one mark required"),
  })
  .strict();

/** POST /api/results — final report row (teacher own-class / admin). */
export const createResultValidator = z
  .object({
    classId: objectIdLike,
    exam: z.string().trim().min(1, "exam required").max(120),
    studentId: objectIdLike,
    subjects: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            marks: z.number().min(0),
            max: z.number().min(1),
          })
          .strict()
          .refine((s) => s.marks <= s.max, "marks must not exceed max"),
      )
      .min(1, "at least one subject required"),
  })
  .strict();

/** GET /api/results — filters; student forced to self server-side. */
export const listResultsQueryValidator = z.object({
  classId: z.string().trim().optional(),
  exam: z.string().trim().optional(),
  studentId: z.string().trim().optional(),
});

/** GET /api/students/me/results — exam selector only. */
export const myResultsQueryValidator = z.object({
  exam: z.string().trim().min(1).optional(),
});
