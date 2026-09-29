import type { NextFunction, Request, Response } from "express";
import * as reportsService from "../services/reports.service.js";
import { ok } from "../utils/response.js";

export async function schoolReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await reportsService.schoolReport(req.user!.instituteId!);
    if (req.query.format === "csv") {
      const csv = [
        "metric,value",
        `students,${(data.headcounts as { students: number }).students}`,
        `teachers,${(data.headcounts as { teachers: number }).teachers}`,
        `classes,${(data.headcounts as { classes: number }).classes}`,
        `feesCollected,${data.fees.collected}`,
        `feesTotal,${data.fees.totalDue}`,
        `complaints,${data.complaints}`,
      ].join("\n");
      res.header("Content-Type", "text/csv").send(csv);
      return;
    }
    ok(res, data);
  } catch (err) {
    next(err);
  }
}

export async function teacherReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await reportsService.teacherReport(req.user!.instituteId!, req.params.id));
  } catch (err) {
    next(err);
  }
}
