import { Lucia, TimeSpan } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_HOURS } from "./constants";

const adapter = new DrizzlePostgreSQLAdapter(db, adminSessions, adminUsers);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    name: SESSION_COOKIE_NAME,
    expires: false, // session cookie; Lucia manages expiry via DB
    attributes: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  sessionExpiresIn: new TimeSpan(SESSION_MAX_AGE_HOURS, "h"),
  getUserAttributes: (attributes) => ({
    email: attributes.email,
    role: attributes.role,
    isActive: attributes.is_active,
  }),
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      email: string;
      role: string;
      is_active: boolean;
    };
  }
}
