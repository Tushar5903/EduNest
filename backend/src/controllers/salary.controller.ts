import type { NextFunction, Request, Response } from "express";
import * as salaryService from "../services/salary.service.js";
import { ok, created } from "../utils/response.js";

export async function listSalaries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await salaryService.listSalaries(req.user!.instituteId!, req.query as never, { role: req.user!.role, id: req.user!.id }));
  } catch (err) {
    next(err);
  }
}

export async function createSalary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    created(res, await salaryService.createSalary(req.user!.id, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function updateSalary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await salaryService.updateSalary(req.user!.id, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function mySalary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await salaryService.mySalary(req.user!.id, req.user!.instituteId!, req.query as never));
  } catch (err) {
    next(err);
  }
}
