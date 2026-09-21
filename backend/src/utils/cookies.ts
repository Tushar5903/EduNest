import type { Response } from "express";
import { env } from "../config/env.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../middleware/auth.middleware.js";

const ACCESS_MAX_AGE = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function baseFlags(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** Sets access + refresh httpOnly cookies. JWT never goes to localStorage. */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, baseFlags(ACCESS_MAX_AGE));
  res.cookie(REFRESH_COOKIE, refreshToken, baseFlags(REFRESH_MAX_AGE));
}

export function clearAuthCookies(res: Response): void {
  // Must mirror set flags (domain/secure/sameSite/path) or browsers keep the
  // cookie when COOKIE_DOMAIN is set in production.
  const flags = baseFlags(0);
  // clearCookie ignores maxAge; Expires is set automatically.
  const { maxAge: _maxAge, ...clearFlags } = flags;
  res.clearCookie(ACCESS_COOKIE, { ...clearFlags, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...clearFlags, path: "/" });
}
