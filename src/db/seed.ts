import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hash } from "argon2";
import { adminUsers, categories, products } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const email = process.env.ADMIN_INITIAL_EMAIL;
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!email || !password) {
    console.error(
      "ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD are required for seeding",
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("ADMIN_INITIAL_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding database...");

  // --- Admin User ---
  const existingAdmin = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existingAdmin.length === 0) {
    const passwordHash = await hash(password, {
      type: 2, // argon2id
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });

    await db.insert(adminUsers).values({
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`Created admin user: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  // --- Categories ---
  const sampleCategories = [
    { name: "Streaming", slug: "streaming", sortOrder: 1 },
    { name: "Gaming", slug: "gaming", sortOrder: 2 },
    { name: "Software", slug: "software", sortOrder: 3 },
    { name: "Music", slug: "music", sortOrder: 4 },
    { name: "Education", slug: "education", sortOrder: 5 },
  ];

  for (const cat of sampleCategories) {
    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, cat.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(categories).values(cat);
      console.log(`Created category: ${cat.name}`);
    } else {
      console.log(`Category already exists: ${cat.name}`);
    }
  }

  // --- Sample Products ---
  const streamingCat = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, "streaming"))
    .limit(1);

  const gamingCat = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, "gaming"))
    .limit(1);

  const sampleProducts = [
    {
      name: "Premium Streaming Account",
      slug: "premium-streaming-account",
      shortDesc: "Access to premium streaming content for 1 month.",
      description:
        "Get full access to premium streaming content including 4K quality, multiple screens, and download capability. Valid for 1 month from activation.",
      price: 499, // $4.99
      status: "active" as const,
      categoryId: streamingCat[0]?.id,
      sortOrder: 1,
    },
    {
      name: "Music Premium Subscription",
      slug: "music-premium-subscription",
      shortDesc: "Ad-free music streaming for 3 months.",
      description:
        "Enjoy ad-free music streaming with offline downloads and high-quality audio. Subscription valid for 3 months.",
      price: 899, // $8.99
      status: "active" as const,
      categoryId: streamingCat[0]?.id,
      sortOrder: 2,
    },
    {
      name: "Game Pass Ultimate Key",
      slug: "game-pass-ultimate-key",
      shortDesc: "1-month Game Pass Ultimate subscription key.",
      description:
        "Redeem this key for 1 month of Game Pass Ultimate. Includes access to hundreds of games on console and PC, plus online multiplayer.",
      price: 1299, // $12.99
      status: "active" as const,
      categoryId: gamingCat[0]?.id,
      sortOrder: 3,
    },
  ];

  for (const prod of sampleProducts) {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, prod.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(products).values(prod);
      console.log(`Created product: ${prod.name}`);
    } else {
      console.log(`Product already exists: ${prod.name}`);
    }
  }

  console.log("Seeding complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
