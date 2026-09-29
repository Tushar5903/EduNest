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
  if (!identifier.includes("@")) {
    throw new Error("Use portal login for ID accounts");
  }
  return apiPost<SessionUser>("/auth/login", { identifier: identifier.trim(), password });
}

export async function requestAccess(input: {
  name: string;
  email: string;
  password: string;
  schoolName: string;
  address?: string;
  phone?: string;
}): Promise<{ instituteId: string; status: string }> {
  return apiPost("/auth/admin-request", input);
}

export async function logout(): Promise<void> {
  await apiPost("/auth/logout");
}

export function homeFor(role: SessionUser["role"]): string {
  return role === "super-admin" ? "/super/dashboard" : "/admin/dashboard";
}
