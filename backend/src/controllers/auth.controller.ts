import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import * as authService from "../services/auth.service.js";
import { clearAuthCookies, setAuthCookies } from "../utils/cookies.js";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../middleware/auth.middleware.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer: reads request, calls auth.service, sets/clears cookies. */

export async function adminRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.requestAdminAccess(req.body);
    created(res, { ...result, status: "pending", message: "Request received — super-admin approval pending" });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body as { identifier: string; password: string };
    const { user, accessToken, refreshToken } = await authService.login(identifier, password);
    setAuthCookies(res, accessToken, refreshToken);
    ok(res, { user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      next({ status: 401, message: "Session expired — please login again" });
      return;
    }
    const { user, accessToken, refreshToken } = await authService.refreshSession(token);
    setAuthCookies(res, accessToken, refreshToken);
    ok(res, { user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Best-effort: drop the stored refresh hash. Prefer the access token, but
    // fall back to the refresh token so logout still revokes the session when
    // the short-lived access token has already expired.
    let userId: string | null = null;
    const access = req.cookies?.[ACCESS_COOKIE];
    if (access) {
      try {
        userId = verifyAccessToken(access).sub;
      } catch {
        userId = null;
      }
    }
    if (!userId) {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      if (refreshToken) {
        try {
          userId = verifyRefreshToken(refreshToken).sub;
        } catch {
          userId = null;
        }
      }
    }
    await authService.logout(userId);
    clearAuthCookies(res);
    ok(res, { message: "Logged out" });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await authService.getSession(req.user!.id);
    ok(res, session);
  } catch (err) {
    next(err);
  }
}
