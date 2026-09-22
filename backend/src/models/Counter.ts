import { Schema, model, type Document } from "mongoose";

/**
 * Global monotonic sequences. loginId must be globally unique (T-XXXX /
 * 6-digit student IDs), so per-institute counters would collide — one counter
 * per key, atomically incremented with findOneAndUpdate ($inc, upsert).
 */
export interface CounterDoc extends Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 1000 },
});

export const Counter = model<CounterDoc>("Counter", counterSchema);

export async function nextSequence(key: "teacher" | "student"): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

/**
 * Student-ID sequence: first ID 100000, then +1, in a single atomic
 * findOneAndUpdate. The pipeline defaults a missing counter to 99999 before
 * adding 1, so the very first call lands exactly on 100000 and concurrent
 * creations can never duplicate (unique index is the backstop).
 */
export async function nextStudentIdSequence(): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { key: "studentId" },
    [{ $set: { seq: { $add: [{ $ifNull: ["$seq", 99999] }, 1] } } }],
    { new: true, upsert: true },
  );
  return doc.seq;
}
