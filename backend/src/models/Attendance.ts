import { Schema, Types, model, type Document } from "mongoose";

export type AttendanceStatus = "present" | "absent";

export interface AttendanceRecord {
  studentId: Types.ObjectId;
  status: AttendanceStatus;
}

export interface AttendanceDoc extends Document {
  instituteId: Types.ObjectId;
  classId: Types.ObjectId;
  /** Day-granular YYYY-MM-DD string. */
  date: string;
  /** Timetable slot this record belongs to. */
  periodId: Types.ObjectId;
  records: AttendanceRecord[];
  markedBy: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const recordSchema = new Schema<AttendanceRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
  },
  { _id: false },
);

const attendanceSchema = new Schema<AttendanceDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, immutable: true, index: true },
    date: { type: String, required: true, trim: true, immutable: true },
    periodId: { type: Schema.Types.ObjectId, ref: "Timetable", required: true, immutable: true },
    records: { type: [recordSchema], default: [] },
    markedBy: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// One document per class-period-day — the same-day upsert safety layer.
attendanceSchema.index({ classId: 1, periodId: 1, date: 1 }, { unique: true });

export const Attendance = model<AttendanceDoc>("Attendance", attendanceSchema);
