"use client";

import { useState } from "react";
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
} from "@/actions/admin/totp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type Step = "idle" | "scanning" | "recovery" | "disable-confirm";

export function TotpSetup({ totpEnabled }: { totpEnabled: boolean }) {
  const [step, setStep] = useState<Step>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBeginSetup() {
    setLoading(true);
    setError("");
    try {
      const result = await beginTotpSetup();
      if (result.success && result.data) {
        setQrDataUrl(result.data.qrDataUrl);
        setManualKey(result.data.secret);
        setStep("scanning");
      } else {
        setError(result.error ?? "Failed to start setup.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError("");
    try {
      const result = await confirmTotpSetup(code);
      if (result.success && result.data) {
        setRecoveryCodes(result.data.recoveryCodes);
        setStep("recovery");
        setCode("");
        toast.success("Two-factor authentication enabled");
      } else {
        setError(result.error ?? "Verification failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setError("");
    try {
      const result = await disableTotp(disableCode);
      if (result.success) {
        setStep("idle");
        setDisableCode("");
        toast.success("Two-factor authentication disabled");
        // Reload to reflect updated state
        window.location.reload();
      } else {
        setError(result.error ?? "Failed to disable 2FA.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === "recovery") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Save Recovery Codes</CardTitle>
          <CardDescription>
            Store these codes in a safe place. Each code can only be used once.
            You will not be able to see them again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-800">
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(recoveryCodes.join("\n"));
              toast.success("Codes copied to clipboard");
            }}
            variant="outline"
          >
            Copy Codes
          </Button>
          <Button onClick={() => window.location.reload()} className="ml-2">
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "scanning") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app, then enter the 6-digit code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="TOTP QR Code" width={200} height={200} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-zinc-500">Manual entry key:</p>
            <code className="block break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
              {manualKey}
            </code>
          </div>
          <div className="space-y-2">
            <Label htmlFor="totp-code">Verification Code</Label>
            <Input
              id="totp-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleConfirm} disabled={loading || code.length !== 6}>
              {loading ? "Verifying..." : "Verify & Enable"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep("idle");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "disable-confirm") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disable Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter your current 6-digit code to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="disable-code">Authentication Code</Label>
            <Input
              id="disable-code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
              pattern="\d{6}"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={loading || disableCode.length !== 6}
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStep("idle");
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Idle state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          {totpEnabled
            ? "Two-factor authentication is currently enabled."
            : "Add an extra layer of security to your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totpEnabled ? (
          <Button
            variant="destructive"
            onClick={() => {
              setStep("disable-confirm");
              setError("");
            }}
          >
            Disable 2FA
          </Button>
        ) : (
          <Button onClick={handleBeginSetup} disabled={loading}>
            {loading ? "Setting up..." : "Enable 2FA"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
