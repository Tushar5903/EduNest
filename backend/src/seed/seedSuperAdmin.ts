/**
 * No-op by design. The Super Admin is environment-backed (SUPER_EMAIL /
 * SUPER_PASSWORD in backend/.env) and authenticated directly against those
 * server-side values at login — it MUST NOT have a record in the normal
 * users collection. There is NO API endpoint that creates or modifies the
 * Super Admin. This function is kept so `npm run seed` stays harmless.
 */
export async function seedSuperAdmin(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[seed] super-admin is environment-backed; no database record required");
}
