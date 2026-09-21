import { Schema, model, type Document } from "mongoose";

export type Role = "super-admin" | "admin" | "teacher" | "student";
export type UserStatus = "pending" | "active" | "suspended" | "rejected";

export interface UserDoc extends Document {
  name: string;
  email?: string;
  /** Global-unique, immutable login: T-XXXX (teacher) / S-XXXX (student). Admins use email. */
  loginId?: string;
  passwordHash: string;
  role: Role;
  /** Null for super-admin. Immutable after creation. */
  instituteId?: Schema.Types.ObjectId | null;
  classId?: Schema.Types.ObjectId | null;
  /** Per-class sequence 1..N. Display/attendance order only — NEVER a login. */
  rollNo?: number;
  gender?: "M" | "F" | "O";
  subject?: string; // teacher's subject
  phone?: string;
  salaryAmount?: number; // teacher monthly amount, set by admin
  status: UserStatus;
  /** Approving admin: a users._id, or the "super-admin" sentinel for the env-backed identity. */
  approvedBy?: Schema.Types.ObjectId | string | null;
  approvedAt?: Date;
  rejectReason?: string;
  active: boolean; // soft-delete flag; false = deleted, history preserved
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
    loginId: { type: String, unique: true, sparse: true, immutable: true, uppercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["super-admin", "admin", "teacher", "student"], required: true, immutable: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", default: null, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null, index: true },
    rollNo: { type: Number, min: 1 },
    gender: { type: String, enum: ["M", "F", "O"] },
    subject: { type: String, trim: true },
    phone: { type: String, trim: true },
    salaryAmount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["pending", "active", "suspended", "rejected"],
      default: "active",
      index: true,
    },
    approvedBy: { type: Schema.Types.Mixed, default: null },
    approvedAt: { type: Date },
    rejectReason: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true },
);

// rollNo unique within (instituteId, classId). Partial index: only documents that
// actually carry a numeric rollNo participate, so admins/teachers (rollNo absent)
// never collide on (instituteId, null, null). A sparse index would NOT help here
// because sparse skips only docs missing ALL indexed fields.
// (academicYear scoping is enforced in user.service via the one-class-per-year invariant.)
userSchema.index(
  { instituteId: 1, classId: 1, rollNo: 1 },
  { unique: true, partialFilterExpression: { rollNo: { $type: "number" } } },
);
userSchema.index({ instituteId: 1, role: 1 });

// Never leak hashes, even if a controller forgets to project them out.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const record = ret as unknown as Record<string, unknown>;
    delete record.passwordHash;
    delete record.refreshTokenHash;
    return ret;
  },
});

export const User = model<UserDoc>("User", userSchema);
