import { createApp } from "./app.js";
import { assertProdEnv, env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { User } from "./models/User.js";

async function main(): Promise<void> {
  assertProdEnv();
  await connectDatabase();
  // Reconcile the User indexes after the class relationship schema changed;
  // this removes any legacy unique instituteId index without changing data.
  await User.syncIndexes();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[edunest-api] listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[edunest-api] failed to start", err);
  process.exit(1);
});
