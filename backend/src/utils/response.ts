import type { Response } from "express";

/** Consistent success envelope: { ok, data, page?, total? } */
export function ok<T>(res: Response, data: T, status = 200, meta?: { page?: number; total?: number }): Response {
  return res.status(status).json({ ok: true, data, ...meta });
}

export function created<T>(res: Response, data: T, meta?: { page?: number; total?: number }): Response {
  return ok(res, data, 201, meta);
}
