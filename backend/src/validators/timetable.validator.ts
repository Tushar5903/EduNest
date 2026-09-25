import { z } from "zod";

const objectIdLike = z.string().trim().min(1);
const hhmm = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM 24h");
const day = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const slotType = z.enum(["regular", "extra", "cancelled"]);

function startBeforeEnd<T extends { startTime?: string; endTime?: string }>(slot: T): T {
  if (slot.startTime && slot.endTime && slot.startTime >= slot.endTime) {
    throw new Error("endTime must be later than startTime");
  }
  return slot;
}

/** POST /api/timetables — instituteId comes from req.user, never the body. */
export const createTimetableValidator = z
  .object({
    classId: objectIdLike,
    subject: z.string().trim().min(1, "subject required"),
    teacherId: objectIdLike,
    day,
    startTime: hhmm,
    endTime: hhmm,
    room: z.string().trim().optional(),
    type: slotType.optional(),
  })
  .strict()
  .transform(startBeforeEnd);

/** PATCH /api/timetables/:id — mutable fields only; ownership immutable. */
export const updateTimetableValidator = z
  .object({
    classId: objectIdLike.optional(),
    subject: z.string().trim().min(1).optional(),
    teacherId: objectIdLike.optional(),
    day: day.optional(),
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    room: z.string().trim().optional(),
    type: slotType.optional(),
  })
  .strict()
  .transform(startBeforeEnd);

/** GET /api/timetables — filters only. */
export const listTimetableQueryValidator = z.object({
  classId: z.string().trim().optional(),
  teacherId: z.string().trim().optional(),
  day: z.string().trim().optional(),
});

/** GET /api/teacher/today-schedule — date + now are optional scheduling hints. */
export const todayScheduleQueryValidator = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
  now: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "now must be HH:MM 24h")
    .optional(),
});
