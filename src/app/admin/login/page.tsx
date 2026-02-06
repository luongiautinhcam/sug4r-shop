import { validateAdminSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  // Redirect to dashboard if already logged in
  const session = await validateAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Admin Login
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to manage your store.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
