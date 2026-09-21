import type { NextFunction, Request, Response } from "express";
import * as classService from "../services/class.service.js";
import { created, ok } from "../utils/response.js";

/** Thin HTTP layer for /api/classes — role scoping enforced in the service. */

export async function createClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    created(res, await classService.createClass(req.user!.id, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function listClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    const { data, page, total } = await classService.listClasses(req.user!.instituteId!, req.query, viewer);
    ok(res, data, 200, { page, total });
  } catch (err) {
    next(err);
  }
}

export async function getClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await classService.getClass(req.user!.instituteId!, req.params.id, viewer));
  } catch (err) {
    next(err);
  }
}

export async function updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await classService.updateClass(req.user!.id, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

export async function deleteClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await classService.deleteClass(req.user!.id, req.user!.instituteId!, req.params.id));
  } catch (err) {
    next(err);
  }
}
