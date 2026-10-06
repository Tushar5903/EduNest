import { api, apiPost, apiPatch } from "./api";

export type InstituteStatus = "pending" | "active" | "suspended";
export type RequestStatus = "pending" | "active" | "suspended" | "rejected";
export type InstituteStatusAction = "block-admin" | "unblock-admin" | "suspend-school" | "unsuspend-school";

export interface DirectoryInstitute {
  instituteId: string;
  schoolName: string;
  code: string;
  admin: { name: string; email?: string; status: string } | null;
  students: number;
  teachers: number;
  classes: number;
  feesCollectedPercent: number;
  complaintCounts: { open: number; total: number };
  status: InstituteStatus;
  createdAt: string;
}

export interface InstituteRequest {
  instituteId: string;
  schoolName: string;
  code: string;
  address?: string;
  phone?: string;
  status: string;
  requestedAt: string;
  admin: { name: string; email?: string; status: string } | null;
}

export interface DirectInstituteInput {
  schoolName: string;
  address?: string;
  phone?: string;
  adminName: string;
  adminEmail: string;
}

export interface DirectInstituteResult {
  instituteId: string;
  adminEmail: string;
  tempPassword: string;
}

export interface SessionUser {
  id: string;
  role: "teacher" | "student" | "admin" | "super-admin";
  instituteId: string | null;
  name: string;
  email?: string;
  instituteStatus?: string;
  adminStatus?: string;
}

export async function listInstitutes(params?: { search?: string; status?: string }): Promise<DirectoryInstitute[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  return api<DirectoryInstitute[]>(`/super/institutes${query.size ? `?${query.toString()}` : ""}`);
}

export async function getInstitute(id: string): Promise<DirectoryInstitute> {
  return api<DirectoryInstitute>(`/super/institutes/${id}`);
}

export async function listRequests(status = "pending"): Promise<InstituteRequest[]> {
  return api<InstituteRequest[]>(`/super/requests?status=${encodeURIComponent(status)}`);
}

export async function approveRequest(id: string): Promise<{ instituteId: string; status: string }> {
  return apiPost(`/super/requests/${id}/approve`);
}

export async function rejectRequest(id: string, reason: string): Promise<{ instituteId: string; status: string }> {
  return apiPost(`/super/requests/${id}/reject`, { reason });
}

export async function setInstituteStatus(
  id: string,
  action: InstituteStatusAction,
  reason: string,
): Promise<{ instituteId: string; action: InstituteStatusAction }> {
  return apiPatch(`/super/institutes/${id}/status`, { action, reason });
}

export async function createInstitute(input: DirectInstituteInput): Promise<DirectInstituteResult> {
  return apiPost<DirectInstituteResult>("/super/institutes", input);
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await api<{ user: SessionUser }>("/auth/me");
  return session.user;
}

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";
export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  severity: AuditSeverity;
  justification?: string;
  diffBefore?: Record<string, unknown>;
  diffAfter?: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
  authMechanism?: string;
}

export interface AuditStats {
  total: number;
  today: number;
  activeAdministrators: number;
  criticalSevenDays: number;
}

export async function listAuditEvents(date?: string): Promise<AuditEvent[]> {
  return api<AuditEvent[]>(`/audit-logs${date ? `?date=${encodeURIComponent(date)}` : ""}`);
}

export async function getAuditStats(): Promise<AuditStats> {
  return api<AuditStats>("/audit-logs/stats");
}
