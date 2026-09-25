import type { NextFunction, Request, Response } from "express";
import * as timetableService from "../services/timetable.service.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer for /api/timetables + /api/teacher/today-schedule. */

export async function createTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    created(res, await timetableService.createTimetable(req.user!.id, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function listTimetables(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await timetableService.listTimetables(req.user!.instituteId!, req.query, viewer));
  } catch (err) {
    next(err);
  }
}

export async function todaySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await timetableService.todaySchedule(req.user!.id, req.user!.instituteId!, req.query));
  } catch (err) {
    next(err);
  }
}

export async function updateTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await timetableService.updateTimetable(req.user!.id, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await timetableService.deleteTimetable(req.user!.id, req.user!.instituteId!, req.params.id));
  } catch (err) {
    next(err);
  }
}
