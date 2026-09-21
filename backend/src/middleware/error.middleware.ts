import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors.js";
import { env } from "../config/env.js";

/** 404 for unknown /api routes. Mount after all routers. */
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ ok: false, error: "Not found" });
}

/** Central error handler. Must be the last middleware. Never leaks stacks in production. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ ok: false, error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  // Plain { status, message } forwarded via next() from middleware/services.
  if (typeof err === "object" && err !== null && "status" in err && "message" in err) {
    const { status, message, details } = err as { status: unknown; message: unknown; details?: unknown };
    if (typeof status === "number" && typeof message === "string") {
      res.status(status).json({ ok: false, error: message, ...(details !== undefined ? { details } : {}) });
      return;
    }
  }
  if (err instanceof Error && err.message.startsWith("CORS blocked")) {
    res.status(403).json({ ok: false, error: "Origin not allowed" });
    return;
  }
  // Mongoose: malformed ObjectId in params → 400 (not 500). Keeps
  // /super/requests/:id/approve, /super/institutes/:id/status, etc. honest.
  if (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "CastError") {
    res.status(400).json({ ok: false, error: "Invalid id format" });
    return;
  }
  // Mongoose schema validation failure → 400.
  if (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "ValidationError") {
    const message = (err as unknown as { message?: string }).message ?? "Validation failed";
    res.status(400).json({ ok: false, error: "Validation failed", details: message });
    return;
  }
  // Mongo duplicate key (race on email/code despite app-level 409 check) → 409.
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  ) {
    const key = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0] ?? "field";
    res.status(409).json({ ok: false, error: `An account with this ${key} already exists` });
    return;
  }
  // Bad RegExp construction from search input (defence-in-depth; callers escape first) → 400.
  if (err instanceof SyntaxError && err.message.includes("Invalid regular expression")) {
    res.status(400).json({ ok: false, error: "Invalid search query" });
    return;
  }
  if (env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(500).json({
    ok: false,
    error: "Internal server error",
    ...(env.NODE_ENV !== "production" && err instanceof Error ? { details: err.message } : {}),
  });
}
