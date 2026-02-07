"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { toast } from "sonner";
import { toggleProductStatus } from "@/actions/admin/products";

interface ProductStatusButtonProps {
  productId: string;
  productName: string;
  currentStatus: string;
}

export function ProductStatusButton({
  productId,
  productName,
  currentStatus,
}: ProductStatusButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (currentStatus === "active") {
    return (
      <ConfirmButton
        title="Archive this product?"
        description={`"${productName}" will be hidden from the catalog. It can be reactivated later.`}
        confirmLabel="Archive"
        variant="outline"
        size="sm"
        onConfirm={async () => {
          const result = await toggleProductStatus(productId, "archived");
          if (!result.success) {
            toast.error(result.error ?? "Failed to archive product");
            return;
          }
          toast.success("Product archived");
          router.refresh();
        }}
      >
        Archive
      </ConfirmButton>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await toggleProductStatus(productId, "active");
          if (!result.success) {
            toast.error(result.error ?? "Failed to activate product");
            return;
          }
          toast.success("Product activated");
          router.refresh();
        });
      }}
    >
      {isPending ? "..." : "Activate"}
    </Button>
  );
}
