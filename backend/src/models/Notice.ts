import { Schema, model, type Document } from "mongoose";

export type NoticeAudience = "all" | "student" | "teacher" | "class";
export type NoticeType = "general" | "extra" | "cancelled";

/**
 * Minimal Notice for this phase: class-info posts (extra/cancelled) that also
 * feed timetable overrides. Full notice CRUD ships in the Notices phase.
 */
export interface NoticeDoc extends Document {
  instituteId: Schema.Types.ObjectId;
  classId?: Schema.Types.ObjectId | null;
  title: string;
  body: string;
  audience: NoticeAudience;
  type: NoticeType;
  createdBy: Schema.Types.ObjectId | string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const noticeSchema = new Schema<NoticeDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", default: null, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audience: { type: String, enum: ["all", "student", "teacher", "class"], required: true },
    type: { type: String, enum: ["general", "extra", "cancelled"], default: "general" },
    createdBy: { type: Schema.Types.Mixed, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Notice = model<NoticeDoc>("Notice", noticeSchema);
