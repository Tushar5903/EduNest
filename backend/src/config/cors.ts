import type { CorsOptions } from "cors";
import { env } from "./env.js";

/** Allowlist: portal + console only. Never "*". */
export function corsOptions(): CorsOptions {
  const allowlist = new Set([env.PORTAL_URL, env.CONSOLE_URL]);
  return {
    origin: (origin, callback) => {
      // Same-origin / curl / health probes have no Origin header — allow.
      if (!origin || allowlist.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  };
}
