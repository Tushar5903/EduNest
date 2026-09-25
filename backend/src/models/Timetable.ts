import { Schema, Types, model, type Document } from "mongoose";

export type TimetableDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
export type TimetableType = "regular" | "extra" | "cancelled";

export interface TimetableDoc extends Document {
  instituteId: Types.ObjectId;
  classId: Types.ObjectId;
  subject: string;
  teacherId: Types.ObjectId;
  /** Weekday this slot recurs on. */
  day: TimetableDay;
  /** HH:MM 24h. Half-open interval [startTime, endTime) for clash checks. */
  startTime: string;
  endTime: string;
  room?: string;
  type: TimetableType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const timetableSchema = new Schema<TimetableDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    subject: { type: String, required: true, trim: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    day: { type: String, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], required: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    room: { type: String, trim: true },
    type: { type: String, enum: ["regular", "extra", "cancelled"], default: "regular" },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Powers clash detection: same teacher + day lookups ordered by start.
timetableSchema.index({ instituteId: 1, day: 1, teacherId: 1, startTime: 1 });

export const Timetable = model<TimetableDoc>("Timetable", timetableSchema);
