"use client";

import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { toast } from "sonner";
import {
  markOrderPaid,
  refundOrder,
} from "@/actions/admin/orders";
import { fulfillOrder } from "@/actions/admin/fulfillment";

interface OrderActionsProps {
  orderId: string;
  status: string;
}

export function OrderActions({ orderId, status }: OrderActionsProps) {
  const router = useRouter();

  async function handleMarkPaid() {
    const result = await markOrderPaid(orderId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to mark as paid");
      return;
    }
    toast.success("Order marked as paid");
    router.refresh();
  }

  async function handleFulfill() {
    const result = await fulfillOrder(orderId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to fulfill order");
      return;
    }
    toast.success("Order fulfilled — delivery links generated");
    router.refresh();
  }

  async function handleRefund() {
    const result = await refundOrder(orderId);
    if (!result.success) {
      toast.error(result.error ?? "Failed to refund order");
      return;
    }
    toast.success("Order refunded");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {status === "pending" && (
        <ConfirmButton
          title="Mark order as paid?"
          description="This will confirm payment was received. The order can then be fulfilled."
          confirmLabel="Mark as Paid"
          onConfirm={handleMarkPaid}
        >
          Mark as Paid
        </ConfirmButton>
      )}
      {status === "paid" && (
        <ConfirmButton
          title="Fulfill this order?"
          description="This will assign inventory items and generate delivery links for the customer."
          confirmLabel="Fulfill"
          onConfirm={handleFulfill}
        >
          Fulfill Order
        </ConfirmButton>
      )}
      {(status === "paid" || status === "fulfilled") && (
        <ConfirmButton
          title="Refund this order?"
          description="This will mark the order as refunded, release inventory items, and invalidate delivery links. This cannot be undone."
          confirmLabel="Refund"
          variant="outline"
          onConfirm={handleRefund}
        >
          Refund
        </ConfirmButton>
      )}
    </div>
  );
}
