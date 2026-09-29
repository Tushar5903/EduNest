import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const monthRe = z.string().trim().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM");

export const createSalaryValidator = z
  .object({
    teacherId: objectIdLike,
    month: monthRe,
    amount: z.number().min(0),
  })
  .strict();

export const listSalaryQueryValidator = z.object({
  teacherId: z.string().trim().optional(),
  month: z.string().trim().optional(),
  status: z.enum(["pending", "paid"]).optional(),
});

export const updateSalaryValidator = z
  .object({
    amount: z.number().min(0).optional(),
    status: z.enum(["pending", "paid"]).optional(),
  })
  .strict();
