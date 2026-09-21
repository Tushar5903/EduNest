import type { NextFunction, Request, Response } from "express";

/**
 * Multi-tenancy guard. Services derive instituteId from req.user; this middleware
 * additionally rejects requests that smuggle a foreign instituteId in body/query
 * (IDOR protection). Super-admin bypasses (cross-institute aggregates).
 */
export function scopeInstitute(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    next({ status: 401, message: "Unauthenticated" });
    return;
  }
  if (user.role === "super-admin") {
    next();
    return;
  }
  const claimed = (req.body?.instituteId as string | undefined) ?? (req.query.instituteId as string | undefined);
  if (claimed && claimed !== user.instituteId) {
    next({ status: 403, message: "Cross-institute access denied" });
    return;
  }
  next();
}
