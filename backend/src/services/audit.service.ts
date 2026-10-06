import { Types } from "mongoose";
import { AuditLog, type AuditAction } from "../models/AuditLog.js";
import { Institute } from "../models/Institute.js";
import { User } from "../models/User.js";
import { assertObjectId, escapeRegExpValue } from "../utils/scope.js";

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
  date?: string;
}

function parseLimit(limit?: string): number {
  const n = Number(limit ?? 100) || 100;
  return Math.min(200, Math.max(1, n));
}

/**
 * Audit feed. Newest first, plain array (frontend callers expect
 * `AuditEvent[]`, not a paginated envelope). Pass `scopedInstituteId` to
 * force institute scoping (admin self-service); query `instituteId` is
 * ignored in that case so one school can never read another's logs.
 */
export async function listAuditEvents(query: ListAuditQuery, scopedInstituteId?: string): Promise<AuditEvent[]> {
  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  if (scopedInstituteId) {
    assertObjectId(scopedInstituteId);
    filter.instituteId = new Types.ObjectId(scopedInstituteId);
  } else if (query.instituteId) {
    assertObjectId(query.instituteId);
    filter.instituteId = new Types.ObjectId(query.instituteId);
  }
  if (query.date?.trim()) {
    const day = new Date(`${query.date.trim()}T00:00:00.000Z`);
    if (!Number.isNaN(day.getTime())) {
      filter.createdAt = { $gte: day, $lt: new Date(day.getTime() + 24 * 60 * 60 * 1000) };
    }
  }
  if (query.search?.trim()) {
    const rx = new RegExp(escapeRegExpValue(query.search.trim()), "i");
    filter.$or = [{ action: rx }, { reason: rx }];
  }
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(parseLimit(query.limit)).lean();
  const instituteIds = [...new Set(rows.map((r) => (r.instituteId ? String(r.instituteId) : "")).filter(Boolean))];
  const actorIds = [
    ...new Set(
      rows
        .map((r) => {
          const raw = r.by ? String(r.by) : "";
          if (!raw || raw === "super-admin" || raw === "system") return "";
          try {
            new Types.ObjectId(raw);
            return raw;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ];
  const [institutes, users] = await Promise.all([
    instituteIds.length
      ? Institute.find({ _id: { $in: instituteIds.map((id) => new Types.ObjectId(id)) } })
          .select("name code")
          .lean()
      : [],
    actorIds.length
      ? User.find({ _id: { $in: actorIds.map((id) => new Types.ObjectId(id)) } })
          .select("name email loginId")
          .lean()
      : [],
  ]);
  const instituteNameById = new Map(
    institutes.map((inst) => [String(inst._id), inst.name || inst.code || String(inst._id)]),
  );
  const userNameById = new Map(
    users.map((u) => [String(u._id), u.name || u.email || u.loginId || String(u._id)]),
  );
  return rows.map((d) => {
    const event = toEvent(
      d as { _id: unknown; by?: unknown; instituteId?: unknown; action: string; reason?: string; createdAt: Date },
    );
    const rawActor = d.by ? String(d.by) : "";
    return {
      ...event,
      actorName: !rawActor ? "system" : rawActor === "super-admin" ? "Super Admin" : (userNameById.get(rawActor) ?? rawActor),
      entityName: event.entityId ? (instituteNameById.get(event.entityId) ?? event.entityId) : "Platform",
    };
  });
}

export async function getAuditStats(scopedInstituteId?: string): Promise<AuditStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const scope: Record<string, unknown> = {};
  if (scopedInstituteId) {
    assertObjectId(scopedInstituteId);
    scope.instituteId = new Types.ObjectId(scopedInstituteId);
  }
  const [total, today, byValues, criticalSevenDays] = await Promise.all([
    AuditLog.countDocuments(scope),
    AuditLog.countDocuments({ ...scope, createdAt: { $gte: startOfDay } }),
    AuditLog.distinct("by", scope),
    AuditLog.countDocuments({ ...scope, action: { $in: CRITICAL_ACTIONS }, createdAt: { $gte: sevenDaysAgo } }),
  ]);
  return {
    total,
    today,
    activeAdministrators: byValues.filter((v) => v !== null && v !== undefined).length,
    criticalSevenDays,
  };
}
