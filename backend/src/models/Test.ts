import { Schema, Types, model, type Document } from "mongoose";

export interface TestDoc extends Document {
  instituteId: Types.ObjectId;
  classId: Types.ObjectId;
  subject: string;
  title: string;
  date: string;
  maxMarks: number;
  createdBy: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

const testSchema = new Schema<TestDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    subject: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    maxMarks: { type: Number, required: true, min: 1 },
    createdBy: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

testSchema.index({ instituteId: 1, classId: 1, subject: 1 });

export const Test = model<TestDoc>("Test", testSchema);

export interface TestMarkDoc extends Document {
  testId: Types.ObjectId;
  instituteId: Types.ObjectId;
  studentId: Types.ObjectId;
  marks: number;
  createdAt: Date;
  updatedAt: Date;
}

const testMarkSchema = new Schema<TestMarkDoc>(
  {
    testId: { type: Schema.Types.ObjectId, ref: "Test", required: true, immutable: true, index: true },
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, immutable: true, index: true },
    marks: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

// One mark per student per test — row-wise upsert safety layer.
testMarkSchema.index({ testId: 1, studentId: 1 }, { unique: true });

export const TestMark = model<TestMarkDoc>("TestMark", testMarkSchema);
