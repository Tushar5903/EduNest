import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessPayload {
  sub: string; // user id
  role: "super-admin" | "admin" | "teacher" | "student";
  instituteId: string | null;
}

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, kind: "refresh" }, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): { sub: string } {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; kind?: string };
  if (decoded.kind !== "refresh") throw new Error("Not a refresh token");
  return { sub: decoded.sub };
}
