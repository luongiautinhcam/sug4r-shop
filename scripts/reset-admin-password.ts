/**
 * sug4r-shop — Admin Password Reset Script
 *
 * Usage:
 *   DATABASE_URL=<connection-string> npx tsx scripts/reset-admin-password.ts <email> <new-password>
 *
 * Requires direct DB access. The new password must be at least 12 characters.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { adminUsers, adminSessions } from "../src/db/schema";

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error(
      "Usage: npx tsx scripts/reset-admin-password.ts <email> <new-password>",
    );
    process.exit(1);
  }

  if (newPassword.length < 12) {
    console.error("ERROR: Password must be at least 12 characters");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Find the admin user
  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (!user) {
    console.error(`ERROR: Admin user not found: ${email}`);
    await client.end();
    process.exit(1);
  }

  // Hash the new password
  const passwordHash = await hash(newPassword, {
    type: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Update password and reset lockout
  await db
    .update(adminUsers)
    .set({
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(adminUsers.id, user.id));

  // Invalidate all existing sessions for this user
  await db
    .delete(adminSessions)
    .where(eq(adminSessions.userId, user.id));

  console.log(`Password reset for: ${email}`);
  console.log("All existing sessions have been invalidated.");

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
