import { randomInt } from "node:crypto";
import { nextSequence, nextStudentIdSequence } from "../models/Counter.js";
import { ApiError } from "./errors.js";

/** Next globally-unique teacher loginId: T-1001… (immutable, login only). */
export async function generateLoginId(role: "teacher"): Promise<string>;
/** @deprecated Student IDs are 6-digit now — use generateStudentId(). Kept for compat. */
export async function generateLoginId(role: "student"): Promise<string>;
export async function generateLoginId(role: "teacher" | "student"): Promise<string> {
  const seq = await nextSequence(role);
  return `${role === "teacher" ? "T" : "S"}-${seq}`;
}

/**
 * Next globally-unique student loginId: 100000, 100001, … (immutable, login).
 * Sequential from the atomic studentId Counter — never random, never S-XXXX.
 */
export async function generateStudentId(): Promise<string> {
  const seq = await nextStudentIdSequence();
  if (seq < 100000 || seq > 999999) throw ApiError.badRequest("Student ID pool exhausted");
  return String(seq).padStart(6, "0");
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
