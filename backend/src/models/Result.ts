import { Schema, Types, model, type Document } from "mongoose";

export interface ResultSubject {
  name: string;
  marks: number;
  max: number;
}

export interface ResultDoc extends Document {
  instituteId: Types.ObjectId;
  classId: Types.ObjectId;
  exam: string;
  studentId: Types.ObjectId;
  subjects: ResultSubject[];
  enteredBy: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ResultSubject>(
  {
    name: { type: String, required: true, trim: true },
    marks: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const resultSchema = new Schema<ResultDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    exam: { type: String, required: true, trim: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    subjects: { type: [subjectSchema], default: [] },
    enteredBy: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// One final row per student per exam in a class.
resultSchema.index({ instituteId: 1, classId: 1, exam: 1, studentId: 1 }, { unique: true });
resultSchema.index({ instituteId: 1, studentId: 1, exam: 1 });

export const Result = model<ResultDoc>("Result", resultSchema);
