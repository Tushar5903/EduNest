import type { NextFunction, Request, Response } from "express";
import * as attendanceService from "../services/attendance.service.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer for /api/attendance + /api/students/me/attendance. */

function actor(req: Request): { id: string; role: string } {
  return { id: req.user!.id, role: req.user!.role };
}

export async function markAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { upserted, attendance } = await attendanceService.markAttendance(actor(req), req.user!.instituteId!, req.body);
    if (upserted) ok(res, attendance);
    else created(res, attendance);
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await attendanceService.listAttendance(req.user!.instituteId!, req.query, viewer));
  } catch (err) {
    next(err);
  }
}
export async function updateAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await attendanceService.updateAttendance(actor(req), req.user!.instituteId!, req.params.id, req.body.records));
  } catch (err) {
    next(err);
  }
}

export async function myAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(
      res,
      await attendanceService.myAttendance(req.user!.id, req.user!.instituteId!, req.query.month as string | undefined),
    );
  } catch (err) {
    next(err);
  }
}
