import type { NextFunction, Request, Response } from "express";
import * as auditService from "../services/audit.service.js";
import { ok } from "../utils/response.js";

export async function listAudits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await auditService.listAuditEvents(req.query as never));
  } catch (err) {
    next(err);
  }
}

export async function auditStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await auditService.getAuditStats());
  } catch (err) {
    next(err);
  }
}
