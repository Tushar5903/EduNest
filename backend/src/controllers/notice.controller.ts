import type { NextFunction, Request, Response } from "express";
import * as noticeService from "../services/notice.service.js";
import { created, ok } from "../utils/response.js";

export async function listNotices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    const { data, page, total } = await noticeService.listNotices(req.user!.instituteId!, req.query as never, viewer);
    ok(res, data, 200, { page, total });
  } catch (err) {
    next(err);
  }
}

export async function createNotice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    created(res, await noticeService.createNotice(actor, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateNotice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    ok(res, await noticeService.updateNotice(actor, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteNotice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    ok(res, await noticeService.deleteNotice(actor, req.user!.instituteId!, req.params.id));
  } catch (err) {
    next(err);
  }
}
