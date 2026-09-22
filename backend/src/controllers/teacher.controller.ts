import type { NextFunction, Request, Response } from "express";
import * as teacherService from "../services/teacher.service.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer for /api/teacher/* — ownership + logic live in the service. */

function ctx(req: Request): { teacherId: string; instituteId: string } {
  return { teacherId: req.user!.id, instituteId: req.user!.instituteId! };
}

export async function getMyClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { teacherId, instituteId } = ctx(req);
    ok(res, await teacherService.myClasses(teacherId, instituteId));
  } catch (err) {
    next(err);
  }
}

export async function getClassDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { teacherId, instituteId } = ctx(req);
    ok(res, await teacherService.classDashboard(teacherId, instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { teacherId, instituteId } = ctx(req);
    // tempPassword returned ONCE — never stored or re-readable.
    created(res, await teacherService.createStudentInOwnClass(teacherId, instituteId, req.body));
  } catch (err) {
    next(err);
  }
}
