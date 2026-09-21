import { Types } from "mongoose";
import { Class } from "../models/Class.js";
import { User } from "../models/User.js";
import { ApiError } from "./errors.js";

export function assertObjectId(id: string): void {
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest("Invalid id format");
}

/** Escape user input before building RegExp — prevents ReDoS / 500 on `***(` etc. */
export function escapeRegExpValue(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Own-institute guards: resource exists elsewhere → 403, missing → 404.
 * Services derive instituteId from req.user — never from client input.
 */
export async function requireClassInInstitute(classId: string, instituteId: string) {
  assertObjectId(classId);
  const klass = await Class.findById(classId);
  if (!klass) throw ApiError.notFound("Class not found");
  if (String(klass.instituteId) !== instituteId) {
    throw ApiError.forbidden("Cross-institute access denied");
  }
  return klass;
}

export async function requireUserInInstitute(userId: string, instituteId: string) {
  assertObjectId(userId);
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  const owner = user.instituteId ? String(user.instituteId) : null;
  if (owner !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  return user;
}
