import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const status: { app: string; db: string; timestamp: string } = {
    app: "ok",
    db: "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    await db.execute(sql`SELECT 1`);
    status.db = "ok";
  } catch {
    status.db = "error";
    return Response.json(status, { status: 503 });
  }

  return Response.json(status, { status: 200 });
}
