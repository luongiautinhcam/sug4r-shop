/**
 * sug4r-shop — Production Seed Script
 *
 * Creates the initial admin user only. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   DATABASE_URL=<url> ADMIN_INITIAL_EMAIL=<email> ADMIN_INITIAL_PASSWORD=<pass> \
 *     npx tsx scripts/seed-production.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { adminUsers } from "../src/db/schema";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  const email = process.env.ADMIN_INITIAL_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!email || !password) {
    console.error(
      "ERROR: ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD are required",
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("ERROR: Password must be at least 12 characters");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Check if admin already exists
  const [existing] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    console.log("No changes made.");
    await client.end();
    process.exit(0);
  }

  // Hash password
  const passwordHash = await hash(password, {
    type: 2, // argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Create admin user
  await db.insert(adminUsers).values({
    email,
    passwordHash,
    role: "admin",
    isActive: true,
  });

  console.log(`Created admin user: ${email}`);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
