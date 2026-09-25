/** Server calendar date (UTC) as YYYY-MM-DD. Attendance same-day rules use this. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday of a YYYY-MM-DD date, computed in UTC for server-TZ independence. */
export function weekdayOf(date: string): string {
  return WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

/** Current server time as HH:MM (local). */
export function nowHM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
