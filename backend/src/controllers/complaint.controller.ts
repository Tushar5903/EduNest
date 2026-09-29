import type { NextFunction, Request, Response } from "express";
import * as complaintService from "../services/complaint.service.js";
import { created, ok } from "../utils/response.js";

export async function createComplaint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    created(res, await complaintService.createComplaint(req.user!.id, req.user!.instituteId!, req.body));
  } catch (err) {
    next(err);
  }
}

export async function myComplaints(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await complaintService.myComplaints(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function teacherInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await complaintService.teacherInbox(req.user!.id, req.user!.instituteId!));
  } catch (err) {
    next(err);
  }
}

export async function adminInbox(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await complaintService.adminInbox(req.user!.instituteId!, req.query as { toType?: string; status?: string }));
  } catch (err) {
    next(err);
  }
}

export async function moderateComplaint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = { id: req.user!.id, role: req.user!.role };
    ok(res, await complaintService.moderateComplaint(actor, req.user!.instituteId!, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}
