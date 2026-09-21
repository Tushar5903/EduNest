import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required env var: ${name} (see backend/.env.example)`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/edunest",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me",
  PORTAL_URL: process.env.PORTAL_URL ?? "http://localhost:3000",
  CONSOLE_URL: process.env.CONSOLE_URL ?? "http://localhost:3001",
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN, // e.g. .edunest.in in prod; undefined on localhost
  // Single source of truth for the super-admin bootstrap credentials.
  // Required in ALL envs (no dev fallback) so a missing .env fails fast
  // instead of silently seeding a publicly-known account.
  SUPER_EMAIL: required("SUPER_EMAIL"),
  SUPER_PASSWORD: required("SUPER_PASSWORD"),
} as const;

export function assertProdEnv(): void {
  if (env.NODE_ENV !== "production") return;
  for (const key of ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "SUPER_EMAIL", "SUPER_PASSWORD"] as const) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }
  if (
    env.JWT_ACCESS_SECRET === "dev-access-secret-change-me" ||
    env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-me"
  ) {
    throw new Error("Refusing to boot in production with dev JWT secrets");
  }
  if (env.SUPER_EMAIL === "super@edunest.in" || env.SUPER_PASSWORD === "Super@123") {
    throw new Error("Refusing to boot in production with default SUPER_ADMIN credentials");
  }
}
