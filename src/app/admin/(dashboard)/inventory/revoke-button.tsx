"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { toast } from "sonner";
import { revokeInventoryItem } from "@/actions/admin/inventory";

export function RevokeButton({ itemId }: { itemId: string }) {
  const router = useRouter();

  async function handleRevoke() {
    const result = await revokeInventoryItem(itemId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to revoke item");
      return;
    }
    toast.success("Inventory item revoked");
    router.refresh();
  }

  return (
    <ConfirmButton
      title="Revoke inventory item?"
      description="This item will be marked as revoked and cannot be sold or delivered. This cannot be undone."
      confirmLabel="Revoke"
      variant="outline"
      size="sm"
      onConfirm={handleRevoke}
    >
      Revoke
    </ConfirmButton>
  );
}
