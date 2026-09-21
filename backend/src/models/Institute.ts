import { Schema, model, type Document } from "mongoose";

export type InstituteStatus = "pending" | "active" | "suspended";

export interface InstituteSettings {
  terminalClassId?: Schema.Types.ObjectId | null;
}

export interface InstituteDoc extends Document {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  adminId?: Schema.Types.ObjectId | null;
  status: InstituteStatus;
  settings: InstituteSettings;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<InstituteSettings>(
  {
    // Last standard of the school (e.g. the 8th class). Promotions beyond it are
    // rejected server-side for every role (see promotion.service, Phase 6).
    terminalClassId: { type: Schema.Types.ObjectId, ref: "Class", default: null },
  },
  { _id: false },
);

const instituteSchema = new Schema<InstituteDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "active", "suspended"], default: "pending", index: true },
    settings: { type: settingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export const Institute = model<InstituteDoc>("Institute", instituteSchema);
