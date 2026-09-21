import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const ACCESS_COOKIE = "edunest_token";
export const REFRESH_COOKIE = "edunest_refresh";

export interface AuthUser {
  id: string;
  role: Role;
  instituteId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Reads the JWT access cookie, verifies it, populates req.user. 401 when absent/invalid. */
export function protect(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    next({ status: 401, message: "Unauthenticated" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, instituteId: payload.instituteId };
    next();
  } catch {
    next({ status: 401, message: "Session expired — please login again" });
  }
}
