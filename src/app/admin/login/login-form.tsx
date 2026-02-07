"use client";

import { useState, useActionState } from "react";
import { loginAction } from "@/actions/auth";
import { verifyTotpLogin } from "@/actions/admin/totp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type { ActionResult } from "@/types";

const initialLoginState: ActionResult<{ requiresTotp?: boolean }> = { success: false };
const initialTotpState: ActionResult = { success: false };

export function LoginForm() {
  const [showTotp, setShowTotp] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const [loginState, loginFormAction, isLoginPending] = useActionState(
    async (prev: ActionResult<{ requiresTotp?: boolean }>, formData: FormData) => {
      const result = await loginAction(prev, formData);
      if (result.success && result.data?.requiresTotp) {
        setShowTotp(true);
      }
      return result;
    },
    initialLoginState,
  );

  const [totpState, totpFormAction, isTotpPending] = useActionState(
    verifyTotpLogin,
    initialTotpState,
  );

  if (showTotp) {
    return (
      <Card>
        <form action={totpFormAction}>
          <CardContent className="space-y-4 pt-6">
            {totpState.error && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {totpState.error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">
                {useRecovery ? "Recovery Code" : "Authentication Code"}
              </Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode={useRecovery ? "text" : "numeric"}
                pattern={useRecovery ? undefined : "\\d{6}"}
                maxLength={useRecovery ? 20 : 6}
                placeholder={useRecovery ? "Enter recovery code" : "000000"}
                required
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
              onClick={() => setUseRecovery(!useRecovery)}
            >
              {useRecovery
                ? "Use authentication code"
                : "Use a recovery code"}
            </button>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isTotpPending}>
              {isTotpPending ? "Verifying..." : "Verify"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <form action={loginFormAction}>
        <CardContent className="space-y-4 pt-6">
          {loginState.error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {loginState.error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoginPending}>
            {isLoginPending ? "Signing in..." : "Sign In"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
