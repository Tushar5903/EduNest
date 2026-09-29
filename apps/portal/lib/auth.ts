import { api, apiPost } from "./api";

export interface SessionUser {
  id: string;
  role: "teacher" | "student" | "admin" | "super-admin";
  instituteId: string | null;
  name: string;
  instituteStatus?: string;
  adminStatus?: string;
}

export async function getMe(): Promise<SessionUser> {
  return api<SessionUser>("/auth/me");
}

export async function login(identifier: string, password: string): Promise<SessionUser> {
  if (!/^(T-|S-)/i.test(identifier.trim()) && /^\d+$/.test(identifier.trim()) === false && identifier.includes("@")) {
    throw new Error("Use console login for email accounts");
  }
  return apiPost<SessionUser>("/auth/login", { identifier: identifier.trim(), password });
}

export async function logout(): Promise<void> {
  await apiPost("/auth/logout");
}

export function homeFor(role: SessionUser["role"]): string {
  return role === "teacher" ? "/teacher/dashboard" : "/student/home";
}
