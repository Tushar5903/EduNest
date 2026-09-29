import { Schema, Types, model, type Document } from "mongoose";

export type ComplaintToType = "teacher" | "admin";
export type ComplaintCategory = "against-student" | "against-teacher" | "other";
export type ComplaintStatus = "open" | "in-review" | "resolved" | "rejected" | "escalated";

export interface ComplaintReply {
  by: Types.ObjectId | string;
  role: string;
  body: string;
  at: Date;
}

export interface ComplaintDoc extends Document {
  instituteId: Types.ObjectId;
  fromStudentId: Types.ObjectId;
  toType: ComplaintToType;
  toTeacherId?: Types.ObjectId | null;
  category: ComplaintCategory;
  targetStudentId?: Types.ObjectId | null;
  targetTeacherId?: Types.ObjectId | null;
  subject: string;
  body: string;
  status: ComplaintStatus;
  replies: ComplaintReply[];
  createdAt: Date;
  updatedAt: Date;
}

const replySchema = new Schema<ComplaintReply>(
  {
    by: { type: Schema.Types.Mixed, required: true },
    role: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const complaintSchema = new Schema<ComplaintDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    fromStudentId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    toType: { type: String, enum: ["teacher", "admin"], required: true, immutable: true },
    toTeacherId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    category: { type: String, enum: ["against-student", "against-teacher", "other"], required: true },
    targetStudentId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    targetTeacherId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in-review", "resolved", "rejected", "escalated"],
      default: "open",
      index: true,
    },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
);

// Rate-limit + mine queries: student's complaints by day.
complaintSchema.index({ instituteId: 1, fromStudentId: 1, createdAt: -1 });
// Teacher inbox: toType teacher + recipient.
complaintSchema.index({ instituteId: 1, toType: 1, toTeacherId: 1, status: 1 });

export const Complaint = model<ComplaintDoc>("Complaint", complaintSchema);
