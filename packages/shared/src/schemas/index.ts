import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "Enter login ID or email"),
  password: z.string().min(1, "Enter password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const adminRequestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  schoolName: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
});
export type AdminRequestInput = z.infer<typeof adminRequestSchema>;

export const createTeacherSchema = z.object({
  name: z.string().min(2),
  subject: z.string().min(1),
  phone: z.string().min(10),
  gender: z.enum(["M", "F", "O"]).optional(),
  salaryAmount: z.number().min(0).optional(),
});
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const createStudentSchema = z.object({
  name: z.string().min(2),
  classId: z.string().min(1),
  gender: z.enum(["M", "F", "O"]).optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const createClassSchema = z.object({
  name: z.string().min(1),
  section: z.string().optional(),
  standard: z.string().optional(),
  teacherId: z.string().optional(),
  academicYear: z.string().min(1),
  order: z.number(),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const promoteSchema = z.object({
  studentIds: z.array(z.string()).optional(),
  entireClass: z.boolean().optional(),
  fromClassId: z.string().min(1),
  toClassId: z.string().min(1).optional(),
});
export type PromoteInput = z.infer<typeof promoteSchema>;

export const createFeeSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().min(0),
  dueDate: z.string().min(1),
  head: z.string().optional(),
});
export type CreateFeeInput = z.infer<typeof createFeeSchema>;

export const createSalarySchema = z.object({
  teacherId: z.string().min(1),
  month: z.string().min(1),
  amount: z.number().min(0),
});
export type CreateSalaryInput = z.infer<typeof createSalarySchema>;

export const createComplaintSchema = z.object({
  toType: z.enum(["teacher", "admin"]),
  toTeacherId: z.string().optional(),
  category: z.enum(["against-student", "against-teacher", "other"]),
  targetStudentId: z.string().optional(),
  targetTeacherId: z.string().optional(),
  subject: z.string().min(4),
  body: z.string().min(10),
});
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const createNoticeSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  audience: z.enum(["all", "student", "teacher", "class"]),
  classId: z.string().optional(),
});
export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

export const createTestSchema = z.object({
  classId: z.string().min(1),
  subject: z.string().min(1),
  title: z.string().min(1),
  date: z.string().min(1),
  maxMarks: z.number().min(1),
});
export type CreateTestInput = z.infer<typeof createTestSchema>;
