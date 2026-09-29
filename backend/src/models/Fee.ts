import { Schema, Types, model, type Document } from "mongoose";

export type FeeStatus = "pending" | "submitted" | "collected" | "paid" | "overdue";

export interface FeeDoc extends Document {
  instituteId: Types.ObjectId;
  studentId: Types.ObjectId;
  amount: number;
  dueDate: string;
  head?: string;
  status: FeeStatus;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const feeSchema = new Schema<FeeDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: String, required: true, trim: true },
    head: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "submitted", "collected", "paid", "overdue"],
      default: "pending",
      index: true,
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

feeSchema.index({ instituteId: 1, studentId: 1, status: 1 });

export const Fee = model<FeeDoc>("Fee", feeSchema);

export interface FeeAuditDoc extends Document {
  feeId: Types.ObjectId;
  instituteId: Types.ObjectId;
  oldStatus: string;
  newStatus: string;
  by: Types.ObjectId | string;
  remark?: string;
  at: Date;
}

const feeAuditSchema = new Schema<FeeAuditDoc>(
  {
    feeId: { type: Schema.Types.ObjectId, ref: "Fee", required: true, immutable: true, index: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    oldStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    by: { type: Schema.Types.Mixed, required: true },
    remark: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

export const FeeAudit = model<FeeAuditDoc>("FeeAudit", feeAuditSchema);
