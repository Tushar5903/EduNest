import { randomInt } from "node:crypto";
import { nextSequence } from "../models/Counter.js";

/** Next globally-unique loginId: T-1001… / S-1001… (immutable, login only). */
export async function generateLoginId(role: "teacher" | "student"): Promise<string> {
  const seq = await nextSequence(role);
  return `${role === "teacher" ? "T" : "S"}-${seq}`;
}

/**
 * 8-char unambiguous reference credential (no 0/O/1/I/L), shown ONCE on
 * create/reset. Only the bcrypt hash is stored.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferenceId(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Next rollNo in a class roster: max(existing) + 1. Gaps are preserved on remove. */
export function nextRollNo(existing: number[]): number {
  return existing.length === 0 ? 1 : Math.max(...existing) + 1;
}
