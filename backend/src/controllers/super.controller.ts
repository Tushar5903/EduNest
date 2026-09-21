import type { NextFunction, Request, Response } from "express";
import * as instituteService from "../services/institute.service.js";
import { created, ok } from "../utils/response.js";

export async function listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = await instituteService.listRequests((req.query.status as string) ?? "pending");
    ok(res, rows);
  } catch (err) {
    next(err);
  }
}

export async function approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await instituteService.approveRequest(req.params.id, req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { reason } = req.body as { reason: string };
    ok(res, await instituteService.rejectRequest(req.params.id, req.user!.id, reason));
  } catch (err) {
    next(err);
  }
}

export async function createInstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // tempPassword is returned ONCE — the admin must share it offline immediately.
    created(res, await instituteService.createInstituteDirect(req.body, req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function listInstitutes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(
      res,
      await instituteService.instituteDirectory(req.query.search as string | undefined, req.query.status as string | undefined),
    );
  } catch (err) {
    next(err);
  }
}

export async function getInstitute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await instituteService.instituteDetail(req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function setInstituteStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, reason } = req.body as { action: never; reason: string };
    ok(res, await instituteService.setInstituteStatus(req.params.id, action, reason, req.user!.id));
  } catch (err) {
    next(err);
  }
}
