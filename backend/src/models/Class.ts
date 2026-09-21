import { Schema, model, type Document } from "mongoose";

export interface ClassDoc extends Document {
  instituteId: Schema.Types.ObjectId;
  name: string;
  section?: string;
  standard?: number;
  teacherId?: Schema.Types.ObjectId | null;
  academicYear: string;
  /** Position in the promotion chain (1 = lowest). Used by promote validation. */
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<ClassDoc>(
  {
    instituteId: { type: Schema.Types.ObjectId, ref: "Institute", required: true, immutable: true, index: true },
    name: { type: String, required: true, trim: true },
    section: { type: String, trim: true },
    standard: { type: Number, min: 1 },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    academicYear: { type: String, required: true, trim: true },
    order: { type: Number, required: true, min: 1 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

classSchema.index({ instituteId: 1, academicYear: 1, name: 1, section: 1 });

export const Class = model<ClassDoc>("Class", classSchema);
