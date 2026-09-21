import type { NextFunction, Request, Response } from "express";
import * as userService from "../services/user.service.js";
import * as classService from "../services/class.service.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer for /api/admin/* — all scoping lives in services + middleware. */

function ctx(req: Request): { adminId: string; instituteId: string } {
  return { adminId: req.user!.id, instituteId: req.user!.instituteId! };
}

export async function createTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    // tempPassword returned ONCE — never stored or re-readable.
    created(res, await userService.createTeacher(adminId, instituteId, req.body));
  } catch (err) {
    next(err);
  }
}

export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    created(res, await userService.createStudent(adminId, instituteId, req.body));
  } catch (err) {
    next(err);
  }
}

export async function listTeachers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, page, total } = await userService.listTeachers(ctx(req).instituteId, req.query);
    ok(res, data, 200, { page, total });
  } catch (err) {
    next(err);
  }
}

export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, page, total } = await userService.listStudents(ctx(req).instituteId, req.query);
    ok(res, data, 200, { page, total });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await userService.getUser(ctx(req).instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await userService.updateUser(adminId, instituteId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await userService.softDeleteUser(adminId, instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    // New tempPassword returned ONCE.
    ok(res, await userService.resetPassword(adminId, instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function removeStudentFromClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await userService.removeStudentFromClass(adminId, instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function reassignStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await userService.reassignStudent(adminId, instituteId, req.params.id, req.body.classId as string));
  } catch (err) {
    next(err);
  }
}

export async function assignClassTeacher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(
      res,
      await userService.assignClassTeacher(adminId, instituteId, req.params.id, req.body.teacherId as string),
    );
  } catch (err) {
    next(err);
  }
}

export async function resequenceRoll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await userService.resequenceRoll(adminId, instituteId, req.params.id));
  } catch (err) {
    next(err);
  }
}

export async function setTerminalClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adminId, instituteId } = ctx(req);
    ok(res, await classService.setTerminalClass(adminId, instituteId, req.body.terminalClassId as string));
  } catch (err) {
    next(err);
  }
}
