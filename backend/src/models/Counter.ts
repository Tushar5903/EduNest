import { Schema, model, type Document } from "mongoose";

/**
 * Global monotonic sequences. loginId must be globally unique (T-XXXX / S-XXXX),
 * so per-institute counters would collide — one counter per key, atomically
 * incremented with findOneAndUpdate ($inc, upsert).
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
