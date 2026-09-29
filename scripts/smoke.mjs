// Workspace + dependency + boot verification (Phase 1 smoke).
import { existsSync } from "node:fs";

const required = [
  "package.json",
  "apps/portal/package.json",
  "apps/portal/middleware.ts",
  "apps/portal/lib/api.ts",
  "apps/portal/lib/auth.ts",
  "apps/portal/app/login/page.tsx",
  "apps/console/package.json",
  "apps/console/middleware.ts",
  "apps/console/lib/api.ts",
  "apps/console/lib/auth.ts",
  "apps/console/app/login/page.tsx",
  "packages/shared/package.json",
  "packages/shared/src/index.ts",
  "backend/package.json",
  "backend/src/app.ts",
  "backend/src/routes/salary.routes.ts",
  "backend/src/routes/promote.routes.ts",
  "backend/src/routes/reports.routes.ts",
  "backend/.env.example",
];

let failed = 0;
for (const f of required) {
  if (!existsSync(new URL(`../${f}`, import.meta.url))) {
    console.error(`[smoke] missing: ${f}`);
    failed += 1;
  }
}
if (failed > 0) {
  console.error(`[smoke] FAIL (${failed} missing)`);
  process.exit(1);
}
console.log("[smoke] manifests OK");

// Express boot check: verify app.ts mounts the required routers (no TS import).
import { readFileSync } from "node:fs";
const appSrc = readFileSync(new URL("../backend/src/app.ts", import.meta.url), "utf8");
const mounts = ["/api/auth", "/api/super", "/api/admin", "/api/salary", "/api/promote", "/api/admin/reports"];
const missing = mounts.filter((m) => !appSrc.includes(`"${m}"`));
if (missing.length > 0) {
  console.error(`[smoke] missing mounts: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("[smoke] express mounts OK");
