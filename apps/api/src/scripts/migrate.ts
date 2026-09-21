import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "../db/client.js";

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");
  await sqlClient.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await sqlClient.end();
  process.exit(1);
});
