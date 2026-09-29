"use client";

import { useEffect, useState } from "react";

/** 1-min ticking clock for Live Queue / timetables. TZ-aware, IST default display. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toMonth(d: Date): string {
  return d.toISOString().slice(0, 7);
}
