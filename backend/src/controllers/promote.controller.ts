import type { NextFunction, Request, Response } from "express";
import * as promoteService from "../services/promote.service.js";
import { ok } from "../utils/response.js";

export async function promote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await promoteService.promote({ id: req.user!.id, role: req.user!.role }, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}
