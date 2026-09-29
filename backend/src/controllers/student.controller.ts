import type { NextFunction, Request, Response } from "express";
import * as studentService from "../services/student.service.js";
import { myAttendance } from "../services/attendance.service.js";
import { myFees } from "../services/fee.service.js";
import { myResults } from "../services/test.service.js";
import { ok } from "../utils/response.js";

/** Thin HTTP layer for /api/students/me/* — identity always from req.user. */

export async function myProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await studentService.myProfile(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function myTeachers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await studentService.myTeachers(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function myTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await studentService.myTimetable(req.user!.id, req.user!.instituteId!, req.query.week as string | undefined));
  } catch (err) {
    next(err);
  }
}

export async function myDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await studentService.myDashboard(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function myResultsSelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await myResults(req.user!.id, req.user!.instituteId!, req.query.exam as string | undefined));
  } catch (err) {
    next(err);
  }
}

export async function myFeesSelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await myFees(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function myAttendanceSelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await myAttendance(req.user!.id, req.user!.instituteId!, req.query.month as string | undefined));
  } catch (err) {
    next(err);
  }
}
