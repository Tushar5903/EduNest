import { api, apiPost } from "./api";

export interface SessionUser {
  id: string;
  role: "teacher" | "student" | "admin" | "super-admin";
  instituteId: string | null;
  name: string;
  instituteStatus?: string;
  adminStatus?: string;
}

/** Backend envelopes: login → { user }, session → { user, banner }. Unwrap here (console parity). */
interface AuthEnvelope {
  user: SessionUser;
}

interface SessionEnvelope {
  user: SessionUser;
  banner: { adminSuspended: boolean; instituteStatus: string };
}

export async function getMe(): Promise<SessionUser> {
  const session = await api<SessionEnvelope>("/auth/me");
  return session.user;
}

export async function login(identifier: string, password: string): Promise<SessionUser> {
  if (!/^(T-|S-)/i.test(identifier.trim()) && /^\d+$/.test(identifier.trim()) === false && identifier.includes("@")) {
    throw new Error("Use console login for email accounts");
  }
  const body = await apiPost<AuthEnvelope>("/auth/login", { identifier: identifier.trim(), password });
  return body.user;
}

export async function logout(): Promise<void> {
  await apiPost("/auth/logout");
}

export function homeFor(role: SessionUser["role"]): string {
  return role === "teacher" ? "/teacher/dashboard" : "/student/home";
}
