import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "academicYear must look like 2025-26");

/** POST /api/classes — instituteId always comes from req.user, never the body. */
export const createClassValidator = z
  .object({
    name: z.string().trim().min(1, "name required"),
    section: z.string().trim().optional(),
    standard: z.number().int().min(1).optional(),
    teacherId: objectIdLike.optional(),
    academicYear,
    order: z.number().int().min(1, "order required"),
  })
  .strict();

/** PATCH /api/classes/:id — mutable fields only; institute ownership immutable. */
export const updateClassValidator = z
  .object({
    name: z.string().trim().min(1).optional(),
    section: z.string().trim().optional(),
    standard: z.number().int().min(1).optional(),
    teacherId: objectIdLike.nullable().optional(),
    academicYear: academicYear.optional(),
    order: z.number().int().min(1).optional(),
  })
  .strict();

/** GET /api/classes — filters only. */
export const listClassesQueryValidator = z.object({
  academicYear: z.string().trim().optional(),
  teacherId: z.string().trim().optional(),
  page: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});

/** PATCH /api/admin/settings/terminal-class */
export const terminalClassValidator = z
  .object({
    terminalClassId: objectIdLike,
  })
  .strict();
