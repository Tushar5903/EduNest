import { z } from "zod";

/** GET /api/students/me/timetable — week window only (Monday-start week derived in service). */
export const myTimetableQueryValidator = z.object({
  week: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "week must be YYYY-MM-DD")
    .optional(),
});
