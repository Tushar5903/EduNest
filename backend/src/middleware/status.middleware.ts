import type { NextFunction, Request, Response } from "express";
import { Institute } from "../models/Institute.js";
import { User } from "../models/User.js";
import { SUPER_ADMIN_ID } from "../services/auth.service.js";

/**
 * Status gate (runs after protect + allowRoles + scopeInstitute).
 * - environment-backed super-admin (sentinel id, server-signed JWT) → pass,
 *   no database record required by design
 * - user missing/soft-deleted → 401
 * - user pending/suspended/rejected → 403 with reason
 * - institute suspended → 403 "School suspended" for every role of that school
 *   (super-admin has no instituteId and is unaffected)
 * A blocked admin's school keeps running: institute stays active, so
 * teacher/student logins continue to pass this gate.
 */
export async function checkStatus(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.user;
    if (!authUser) {
      next({ status: 401, message: "Unauthenticated" });
      return;
    }
    // The JWT role was signed server-side at login; the sentinel id proves the
    // env-backed identity without a users-collection record.
    if (authUser.id === SUPER_ADMIN_ID && authUser.role === "super-admin") {
      next();
      return;
    }
    const user = await User.findById(authUser.id).select("status active instituteId role");
    if (!user || !user.active) {
      next({ status: 401, message: "Account no longer exists" });
      return;
    }
    if (user.status === "pending") {
      next({ status: 403, message: "Account pending approval" });
      return;
    }
    if (user.status === "suspended") {
      next({ status: 403, message: "Account suspended — contact administration" });
      return;
    }
    if (user.status === "rejected") {
      next({ status: 403, message: "Access request was rejected" });
      return;
    }
    if (user.instituteId) {
      const institute = await Institute.findById(user.instituteId).select("status");
      if (!institute) {
        next({ status: 403, message: "School record not found" });
        return;
      }
      if (institute.status === "suspended") {
        next({ status: 403, message: "School suspended — contact super-admin" });
        return;
      }
      if (institute.status === "pending") {
        next({ status: 403, message: "School pending approval" });
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}
