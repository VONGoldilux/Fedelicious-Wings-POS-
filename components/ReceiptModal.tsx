"use client";

import { Printer, X } from "lucide-react";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

export default function ReceiptModal({
  order,
  cashierName,
  onClose,
}: {
  order: Order;
  cashierName?: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} maxWidth="sm">
      <div className="mb-4 text-center">
        <h2 className="font-display text-lg font-semibold text-char-900 dark:text-cream">
          Fedelicious Wings
        </h2>
        <p className="text-xs text-char-700/50 dark:text-cream/50">Talisay, Batangas</p>
        <p className="mt-2 text-xs text-char-700/50 dark:text-cream/50">Official Receipt</p>
      </div>

      <div className="mb-3 flex justify-between text-sm text-char-700/70 dark:text-cream/70">
        <span>Order #{order.order_number}</span>
        <span>{formatDateTime(order.created_at)}</span>
      </div>
      <p className="mb-1 text-xs text-char-700/50 dark:text-cream/50">
        {ORDER_TYPE_LABEL[order.order_type] ?? order.order_type}
        {order.order_type === "dine_in" && order.table_number
          ? ` · Table ${order.table_number}`
          : ""}
      </p>
      {order.order_type === "delivery" && order.delivered_by && (
        <p className="mb-1 text-xs text-char-700/50 dark:text-cream/50">
          Delivered by {order.delivered_by}
        </p>
      )}
      {cashierName && (
        <p className="mb-3 text-xs text-char-700/50 dark:text-cream/50">Served by {cashierName}</p>
      )}

      <div className="mb-3 space-y-1.5 border-y border-dashed border-char-700/20 py-3 dark:border-cream/20">
        {order.order_items?.map((it) => (
          <div key={it.id}>
            <div className="flex justify-between text-sm">
              <span className="text-char-800 dark:text-cream/90">
                {it.quantity}× {it.product_name}
              </span>
              <span className="text-char-800 dark:text-cream/90">{formatPeso(it.line_total)}</span>
            </div>
            {it.special_instructions && (
              <p className="text-xs italic text-char-700/50 dark:text-cream/50">
                Note: {it.special_instructions}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-char-700/70 dark:text-cream/70">
          <span>Subtotal</span>
          <span>{formatPeso(order.subtotal)}</span>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex justify-between text-green-700 dark:text-green-400">
            <span>Discount{order.promo_name ? ` (${order.promo_name})` : ""}</span>
            <span>−{formatPeso(order.discount_amount)}</span>
          </div>
        )}
        {order.senior_pwd_discount_total > 0 && (
          <div className="flex justify-between text-green-700 dark:text-green-400">
            <span>Senior/PWD discount (20%)</span>
            <span>−{formatPeso(order.senior_pwd_discount_total)}</span>
          </div>
        )}
        {order.container_fee > 0 && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Containers ({order.container_count})</span>
            <span>+{formatPeso(order.container_fee)}</span>
          </div>
        )}
        {order.delivery_fee > 0 && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Delivery fee</span>
            <span>+{formatPeso(order.delivery_fee)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-semibold text-char-900 dark:text-cream">
          <span>Total</span>
          <span>{formatPeso(order.total)}</span>
        </div>
        {order.payment_method && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Payment</span>
            <span>{paymentMethodLabel(order.payment_method)}</span>
          </div>
        )}
        {order.payment_provider && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Via</span>
            <span>{order.payment_provider}</span>
          </div>
        )}
        {order.payment_reference && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Reference #</span>
            <span>{order.payment_reference}</span>
          </div>
        )}
        {order.amount_tendered != null && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Tendered</span>
            <span>{formatPeso(order.amount_tendered)}</span>
          </div>
        )}
        {order.change_due != null && (
          <div className="flex justify-between text-char-700/70 dark:text-cream/70">
            <span>Change</span>
            <span>{formatPeso(order.change_due)}</span>
          </div>
        )}
      </div>

      {order.senior_pwd_details.length > 0 && (
        <div className="mt-4 border-t border-dashed border-char-700/20 pt-3 dark:border-cream/20">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
            Senior/PWD discount detail
          </p>
          <div className="space-y-1.5">
            {order.senior_pwd_details.map((entry, i) => (
              <div key={i} className="text-xs text-char-700/70 dark:text-cream/70">
                <p className="font-medium text-char-800 dark:text-cream/90">
                  {entry.name} —{" "}
                  <span className="capitalize">{entry.id_type}</span> ID #
                  {entry.id_number}
                </p>
                <p>
                  {entry.items
                    .map((it) => `${it.quantity}× ${it.product_name}`)
                    .join(", ")}{" "}
                  · −{formatPeso(entry.discount_amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-xs capitalize text-char-700/40 dark:text-cream/40">
        Status: {order.status}
      </p>
      {order.status === "cancelled" && order.cancel_reason && (
        <p className="mt-1 text-center text-xs text-ember-600 dark:text-ember-400">
          Reason: {order.cancel_reason}
        </p>
      )}

      <div className="mt-5 flex gap-2 print:hidden">
        <Button variant="outline" fullWidth icon={<Printer size={15} />} onClick={() => window.print()}>
          Print
        </Button>
        <Button fullWidth icon={<X size={15} />} onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
