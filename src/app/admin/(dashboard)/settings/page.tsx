import { eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { getSettings } from "@/actions/admin/settings";
import { requireAdmin } from "@/lib/auth-guard";
import { SettingsForm } from "./settings-form";
import { TotpSetup } from "./totp-setup";

export const metadata = {
  title: "Settings",
};

export default async function AdminSettingsPage() {
  const { user } = await requireAdmin();
  const settings = await getSettings();

  // Fetch totpEnabled from DB (Lucia user attributes don't include it)
  const [dbUser] = await db
    .select({ totpEnabled: adminUsers.totpEnabled })
    .from(adminUsers)
    .where(eq(adminUsers.id, user.id))
    .limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manage store configuration
        </p>
      </div>

      <SettingsForm initialSettings={settings} />

      <TotpSetup totpEnabled={dbUser?.totpEnabled ?? false} />
    </div>
  );
}
