import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

/** Validates req.body against a Zod schema. 400 with field details on failure. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next({ status: 400, message: "Validation failed", details: err.flatten().fieldErrors });
        return;
      }
      next(err);
    }
  };
}

/** Validates req.query against a Zod schema. 400 with field details on failure. */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as Request["query"];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next({ status: 400, message: "Validation failed", details: err.flatten().fieldErrors });
        return;
      }
      next(err);
    }
  };
}
