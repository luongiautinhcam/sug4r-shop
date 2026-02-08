import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT id, email, role, is_active, failed_attempts, locked_until, totp_enabled, last_login_at, created_at
    FROM admin_users
    LIMIT 5
  `;
  for (const r of rows) {
    console.log(JSON.stringify(r, null, 2));
  }
  if (rows.length === 0) {
    console.log("No admin users found in database!");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
