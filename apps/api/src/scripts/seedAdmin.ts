import { eq } from "drizzle-orm";
import { db, sqlClient } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { env } from "../env.js";
import { createAdminUser } from "../modules/admin-auth/service.js";
import { normalizeEmail } from "../lib/normalize.js";

/**
 * Bootstraps the first platform_admin account. Without this, nobody can log
 * into the Admin Console after a first deploy — admin login is
 * provisioned-only, there is no self-serve signup by design.
 *
 * Usage: npm run db:seed:admin --workspace apps/api
 * Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from the environment. Safe to
 * re-run — it's a no-op if an admin with that email already exists.
 */
async function main() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the first admin.");
    process.exit(1);
  }

  const email = normalizeEmail(env.SEED_ADMIN_EMAIL);
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  if (existing) {
    console.log(`Admin ${email} already exists (id=${existing.id}) — nothing to do.`);
  } else {
    const created = await createAdminUser(db, { email, password: env.SEED_ADMIN_PASSWORD, role: "platform_admin" });
    console.log(`Created platform_admin ${email} (id=${created.id}).`);
  }

  await sqlClient.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Seeding admin failed:", err);
  await sqlClient.end();
  process.exit(1);
});
