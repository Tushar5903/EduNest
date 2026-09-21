import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { seedSuperAdmin } from "./seedSuperAdmin.js";

async function main(): Promise<void> {
  await connectDatabase();
  await seedSuperAdmin();
  await disconnectDatabase();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed", err);
  process.exit(1);
});
