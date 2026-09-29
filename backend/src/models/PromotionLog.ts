import { Schema, Types, model, type Document } from "mongoose";

export interface PromotionLogDoc extends Document {
  instituteId: Types.ObjectId;
  by: Types.ObjectId | string;
  studentId: Types.ObjectId;
  fromClassId: Types.ObjectId | null;
  toClassId: Types.ObjectId | null;
  action: "promote" | "demote" | "pass-out" | "reassign";
  reason?: string;
  at: Date;
}

const promotionLogSchema = new Schema<PromotionLogDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    by: { type: Schema.Types.Mixed, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fromClassId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    toClassId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
    action: { type: String, enum: ["promote", "demote", "pass-out", "reassign"], required: true },
    reason: { type: String, trim: true },
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

export const PromotionLog = model<PromotionLogDoc>("PromotionLog", promotionLogSchema);
