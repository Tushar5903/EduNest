import { z } from "zod";

/** Login identifier = email (admin/super-admin) OR loginId T-XXXX/S-XXXX (teacher/student). */
export const loginValidator = z.object({
  identifier: z.string().trim().min(1, "identifier required"),
  password: z.string().min(1, "password required"),
});

export const adminRequestValidator = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  schoolName: z.string().trim().min(2),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});
