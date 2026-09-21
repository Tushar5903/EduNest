import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User.js";

/** Authoritative RBAC gate. Frontend route guards are UX only — this is the real wall. */
export function allowRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next({ status: 401, message: "Unauthenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      next({ status: 403, message: "Forbidden for this role" });
      return;
    }
    next();
  };
}
