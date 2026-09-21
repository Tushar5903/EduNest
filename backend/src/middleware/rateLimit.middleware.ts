import { rateLimit } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

/** Normal login: 10 req/min/IP. */
const portalLoginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts — try again in a minute" },
});

/** Console (admin/super-admin) login: stricter 5 req/min/IP. */
const consoleLoginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts — try again in a minute" },
});

/** Picks the limiter by X-Client header (portal | console). */
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const client = req.header("X-Client");
  if (client === "console") {
    consoleLoginLimiter(req, res, next);
    return;
  }
  portalLoginLimiter(req, res, next);
}
