import { requireAdmin } from "@/lib/auth-guard";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/header";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader email={user.email} />
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-6 dark:bg-zinc-900">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
