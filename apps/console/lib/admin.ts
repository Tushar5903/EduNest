import { api } from "./api";
import type { AuditEvent, AuditStats } from "./super";

export async function listAdminAuditEvents(): Promise<AuditEvent[]> {
  return api<AuditEvent[]>("/admin/audit-logs");
}

export async function getAdminAuditStats(): Promise<AuditStats> {
  return api<AuditStats>("/admin/audit-logs/stats");
}
