import { Types } from "mongoose";
import { AuditLog, type AuditAction } from "../models/AuditLog.js";
import { assertObjectId, escapeRegExpValue } from "../utils/scope.js";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  severity: AuditSeverity;
  justification?: string;
}

export interface AuditStats {
  total: number;
  today: number;
  activeAdministrators: number;
  criticalSevenDays: number;
}

const CRITICAL_ACTIONS: AuditAction[] = ["admin.blocked", "school.suspended"];
const WARNING_ACTIONS: AuditAction[] = ["admin.rejected", "admin.unblocked", "school.unsuspended"];

function severityFor(action: string): AuditSeverity {
  if ((CRITICAL_ACTIONS as string[]).includes(action)) return "CRITICAL";
  if ((WARNING_ACTIONS as string[]).includes(action)) return "WARNING";
  return "INFO";
}

function toEvent(doc: {
  _id: unknown;
  by?: unknown;
  instituteId?: unknown;
  action: string;
  reason?: string;
  createdAt: Date;
}): AuditEvent {
  const instituteId = doc.instituteId ? String(doc.instituteId) : "";
  return {
    id: String(doc._id),
    timestamp: doc.createdAt.toISOString(),
    actor: doc.by ? String(doc.by) : "system",
    action: doc.action,
    entityType: instituteId ? "institute" : "platform",
    entityId: instituteId,
    severity: severityFor(doc.action),
    ...(doc.reason ? { justification: doc.reason } : {}),
  };
}

export interface ListAuditQuery {
  search?: string;
  action?: string;
  instituteId?: string;
  limit?: string;
}

function parseLimit(limit?: string): number {
  const n = Number(limit ?? 100) || 100;
  return Math.min(200, Math.max(1, n));
}

/**
 * Super-admin global audit feed. Newest first, plain array (frontend
 * `listAuditEvents()` expects `AuditEvent[]`, not a paginated envelope).
 */
export async function listAuditEvents(query: ListAuditQuery): Promise<AuditEvent[]> {
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  if (query.instituteId) {
    assertObjectId(query.instituteId);
    filter.instituteId = new Types.ObjectId(query.instituteId);
  }
  if (query.search?.trim()) {
    const rx = new RegExp(escapeRegExpValue(query.search.trim()), "i");
    filter.$or = [{ action: rx }, { reason: rx }];
  }
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(parseLimit(query.limit)).lean();
  return rows.map((d) =>
    toEvent(d as { _id: unknown; by?: unknown; instituteId?: unknown; action: string; reason?: string; createdAt: Date }),
  );
}

export async function getAuditStats(): Promise<AuditStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, today, byValues, criticalSevenDays] = await Promise.all([
    AuditLog.countDocuments({}),
    AuditLog.countDocuments({ createdAt: { $gte: startOfDay } }),
    AuditLog.distinct("by"),
    AuditLog.countDocuments({ action: { $in: CRITICAL_ACTIONS }, createdAt: { $gte: sevenDaysAgo } }),
  ]);
  return {
    total,
    today,
    activeAdministrators: byValues.filter((v) => v !== null && v !== undefined).length,
    criticalSevenDays,
  };
}
