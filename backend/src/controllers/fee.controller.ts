import type { NextFunction, Request, Response } from "express";
import * as feeService from "../services/fee.service.js";
import { created, ok } from "../utils/response.js";

export async function myFees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await feeService.myFees(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function listFees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await feeService.listFees(req.user!.instituteId!, req.query as never, viewer));
  } catch (err) {
    next(err);
  }
}

export async function createFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    created(res, await feeService.createFee(req.user!.id, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateFee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await feeService.updateFee(req.user!.id, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function teacherFeeStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await feeService.teacherFeeStatus(req.user!.id, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function feeAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await feeService.feeAudit(req.user!.instituteId!, req.params.id));
  } catch (err) {
    next(err);
  }
}
