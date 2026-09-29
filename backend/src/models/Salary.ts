import { Schema, Types, model, type Document } from "mongoose";

export type SalaryStatus = "pending" | "paid";

export interface SalaryDoc extends Document {
  instituteId: Types.ObjectId;
  teacherId: Types.ObjectId;
  month: string;
  amount: number;
  status: SalaryStatus;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const salarySchema = new Schema<SalaryDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    month: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

salarySchema.index({ instituteId: 1, teacherId: 1, month: 1 }, { unique: true });

export const Salary = model<SalaryDoc>("Salary", salarySchema);
