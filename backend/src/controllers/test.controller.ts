import type { NextFunction, Request, Response } from "express";
import * as testService from "../services/test.service.js";
import { created, ok } from "../utils/response.js";

export async function createTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    created(res, await testService.createTest(actor, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function listTests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await testService.listTests(req.user!.instituteId!, req.query as never, viewer));
  } catch (err) {
    next(err);
  }
}

export async function saveMarks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    ok(res, await testService.saveMarks(actor, req.user!.instituteId!, req.params.id, req.body.marks));
  } catch (err) {
    next(err);
  }
}

export async function publishResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    created(res, await testService.publishResult(actor, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function listResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const viewer = { role: req.user!.role, id: req.user!.id };
    ok(res, await testService.listResults(req.user!.instituteId!, req.query as never, viewer));
  } catch (err) {
    next(err);
  }
}

export async function myResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await testService.myResults(req.user!.id, req.user!.instituteId!, req.query.exam as string | undefined));
  } catch (err) {
    next(err);
  }
}
