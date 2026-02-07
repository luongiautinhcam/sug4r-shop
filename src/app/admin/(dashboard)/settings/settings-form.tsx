"use client";

import { useState, useTransition } from "react";
import { updateSettings, type StoreSettings } from "@/actions/admin/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: StoreSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  function handleChange(
    key: keyof StoreSettings,
    value: string | number | boolean,
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateSettings(settings);
      if (result.success) {
        toast.success("Settings saved successfully");
      } else {
        toast.error(result.error ?? "Failed to save settings");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Store Information */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Store Information
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              value={settings.storeName}
              onChange={(e) => handleChange("storeName", e.target.value)}
              maxLength={255}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeCurrency">Currency</Label>
            <Input
              id="storeCurrency"
              value={settings.storeCurrency}
              onChange={(e) =>
                handleChange("storeCurrency", e.target.value.toUpperCase())
              }
              maxLength={3}
              placeholder="USD"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={settings.contactEmail}
              onChange={(e) => handleChange("contactEmail", e.target.value)}
              placeholder="support@example.com"
            />
          </div>
        </div>
      </section>

      {/* Payment Configuration */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Payment Configuration
        </h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              id="paymentManualEnabled"
              type="checkbox"
              checked={settings.paymentManualEnabled}
              onChange={(e) =>
                handleChange("paymentManualEnabled", e.target.checked)
              }
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
            />
            <Label htmlFor="paymentManualEnabled">
              Enable Manual Bank Transfer
            </Label>
          </div>
          {settings.paymentManualEnabled && (
            <div className="space-y-2">
              <Label htmlFor="paymentManualInstructions">
                Bank Transfer Instructions
              </Label>
              <textarea
                id="paymentManualInstructions"
                value={settings.paymentManualInstructions}
                onChange={(e) =>
                  handleChange("paymentManualInstructions", e.target.value)
                }
                rows={4}
                maxLength={5000}
                placeholder="Enter bank transfer instructions that will be shown to customers..."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
              />
            </div>
          )}
        </div>
      </section>

      {/* Delivery Configuration */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Delivery Configuration
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deliveryTokenExpiryHours">
              Token Expiry (hours)
            </Label>
            <Input
              id="deliveryTokenExpiryHours"
              type="number"
              min={1}
              max={720}
              value={settings.deliveryTokenExpiryHours}
              onChange={(e) =>
                handleChange(
                  "deliveryTokenExpiryHours",
                  parseInt(e.target.value) || 1,
                )
              }
            />
            <p className="text-xs text-zinc-500">
              How long delivery links stay active (1–720 hours)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliveryMaxReveals">Max Reveals per Token</Label>
            <Input
              id="deliveryMaxReveals"
              type="number"
              min={1}
              max={10}
              value={settings.deliveryMaxReveals}
              onChange={(e) =>
                handleChange(
                  "deliveryMaxReveals",
                  parseInt(e.target.value) || 1,
                )
              }
            />
            <p className="text-xs text-zinc-500">
              How many times a delivery token can be revealed (1–10)
            </p>
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
