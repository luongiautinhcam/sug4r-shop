/**
 * sug4r-shop — Encryption Key Rotation Script
 *
 * Re-encrypts all inventory items from an old key to a new key.
 * Processes in batches within a single transaction (all or nothing).
 *
 * Prerequisites:
 *   - Old key: ENCRYPTION_KEY_V1 (or whatever the current keyId is)
 *   - New key: ENCRYPTION_KEY_V2 (or the target keyId)
 *   - Both must be set in the environment
 *
 * Usage:
 *   DATABASE_URL=<url> ENCRYPTION_KEY_V1=<old> ENCRYPTION_KEY_V2=<new> \
 *     npx tsx scripts/rotate-encryption-key.ts v1 v2
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { inventoryItems } from "../src/db/schema";
import { decrypt, encrypt } from "../src/lib/crypto";

const BATCH_SIZE = 100;

async function main() {
  const oldKeyId = process.argv[2] || "v1";
  const newKeyId = process.argv[3] || "v2";

  if (oldKeyId === newKeyId) {
    console.error("ERROR: Old and new key IDs must be different");
    process.exit(1);
  }

  // Verify both keys are available
  const oldKeyEnv = `ENCRYPTION_KEY_${oldKeyId.toUpperCase()}`;
  const newKeyEnv = `ENCRYPTION_KEY_${newKeyId.toUpperCase()}`;

  if (!process.env[oldKeyEnv]) {
    console.error(`ERROR: ${oldKeyEnv} is not set`);
    process.exit(1);
  }
  if (!process.env[newKeyEnv]) {
    console.error(`ERROR: ${newKeyEnv} is not set`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("ERROR: DATABASE_URL is required");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  // Count items to rotate
  const items = await db
    .select({
      id: inventoryItems.id,
      encryptedPayload: inventoryItems.encryptedPayload,
      encryptionIv: inventoryItems.encryptionIv,
      encryptionTag: inventoryItems.encryptionTag,
      encryptionKeyId: inventoryItems.encryptionKeyId,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.encryptionKeyId, oldKeyId));

  console.log(`Found ${items.length} items using key "${oldKeyId}"`);

  if (items.length === 0) {
    console.log("Nothing to rotate.");
    await client.end();
    process.exit(0);
  }

  console.log(`Rotating to key "${newKeyId}" in batches of ${BATCH_SIZE}...`);

  let rotated = 0;
  let failed = 0;

  // Process in a single transaction
  await db.transaction(async (tx) => {
    for (const item of items) {
      try {
        // Decrypt with old key
        const plaintext = decrypt({
          encrypted: item.encryptedPayload as unknown as Buffer,
          iv: item.encryptionIv as unknown as Buffer,
          tag: item.encryptionTag as unknown as Buffer,
          keyId: oldKeyId,
        });

        // Re-encrypt with new key
        const newPayload = encrypt(plaintext, newKeyId);

        // Update in DB
        await tx
          .update(inventoryItems)
          .set({
            encryptedPayload: newPayload.encrypted,
            encryptionIv: newPayload.iv,
            encryptionTag: newPayload.tag,
            encryptionKeyId: newKeyId,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.id));

        rotated++;

        if (rotated % BATCH_SIZE === 0) {
          console.log(`  Progress: ${rotated}/${items.length}`);
        }
      } catch (err) {
        failed++;
        console.error(`  FAILED item ${item.id}: ${(err as Error).message}`);
        throw new Error(
          `Rotation aborted at item ${item.id}. Transaction rolled back. ${rotated} items were NOT committed.`,
        );
      }
    }
  });

  console.log(`\nRotation complete:`);
  console.log(`  Rotated: ${rotated}`);
  console.log(`  Failed:  ${failed}`);
  console.log(
    `\nYou can now remove ${oldKeyEnv} from the environment once you've verified everything works.`,
  );

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Rotation failed:", err.message);
  process.exit(1);
});
