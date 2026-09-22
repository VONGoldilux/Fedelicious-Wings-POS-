"use client";

import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import type { Order } from "@/lib/types";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:bg-white"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl print:shadow-none"
      >
        <div className="mb-4 text-center">
          <h2 className="font-display text-lg font-semibold text-char-900">
            Fedelicious Wings
          </h2>
          <p className="text-xs text-char-700/50">Talisay, Batangas</p>
          <p className="mt-2 text-xs text-char-700/50">Official Receipt</p>
        </div>

        <div className="mb-3 flex justify-between text-sm text-char-700/70">
          <span>Order #{order.order_number}</span>
          <span>{formatDateTime(order.created_at)}</span>
        </div>
        <p className="mb-1 text-xs text-char-700/50">
          {ORDER_TYPE_LABEL[order.order_type] ?? order.order_type}
          {order.order_type === "dine_in" && order.table_number
            ? ` · Table ${order.table_number}`
            : ""}
        </p>
        {order.order_type === "delivery" && order.delivered_by && (
          <p className="mb-1 text-xs text-char-700/50">
            Delivered by {order.delivered_by}
          </p>
        )}
        {cashierName && (
          <p className="mb-3 text-xs text-char-700/50">Served by {cashierName}</p>
        )}

        <div className="mb-3 space-y-1.5 border-y border-dashed border-char-700/20 py-3">
          {order.order_items?.map((it) => (
            <div key={it.id}>
              <div className="flex justify-between text-sm">
                <span className="text-char-800">
                  {it.quantity}× {it.product_name}
                </span>
                <span className="text-char-800">{formatPeso(it.line_total)}</span>
              </div>
              {it.special_instructions && (
                <p className="text-xs italic text-char-700/50">
                  Note: {it.special_instructions}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-char-700/70">
            <span>Subtotal</span>
            <span>{formatPeso(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount{order.promo_name ? ` (${order.promo_name})` : ""}</span>
              <span>−{formatPeso(order.discount_amount)}</span>
            </div>
          )}
          {order.senior_pwd_discount_total > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Senior/PWD discount (20%)</span>
              <span>−{formatPeso(order.senior_pwd_discount_total)}</span>
            </div>
          )}
          {order.container_fee > 0 && (
            <div className="flex justify-between text-char-700/70">
              <span>Containers ({order.container_count})</span>
              <span>+{formatPeso(order.container_fee)}</span>
            </div>
          )}
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-char-700/70">
              <span>Delivery fee</span>
              <span>+{formatPeso(order.delivery_fee)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-char-900">
            <span>Total</span>
            <span>{formatPeso(order.total)}</span>
          </div>
          {order.payment_method && (
            <div className="flex justify-between text-char-700/70">
              <span>Payment</span>
              <span>{paymentMethodLabel(order.payment_method)}</span>
            </div>
          )}
          {order.payment_provider && (
            <div className="flex justify-between text-char-700/70">
              <span>Via</span>
              <span>{order.payment_provider}</span>
            </div>
          )}
          {order.payment_reference && (
            <div className="flex justify-between text-char-700/70">
              <span>Reference #</span>
              <span>{order.payment_reference}</span>
            </div>
          )}
          {order.amount_tendered != null && (
            <div className="flex justify-between text-char-700/70">
              <span>Tendered</span>
              <span>{formatPeso(order.amount_tendered)}</span>
            </div>
          )}
          {order.change_due != null && (
            <div className="flex justify-between text-char-700/70">
              <span>Change</span>
              <span>{formatPeso(order.change_due)}</span>
            </div>
          )}
        </div>

        {order.senior_pwd_details.length > 0 && (
          <div className="mt-4 border-t border-dashed border-char-700/20 pt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-char-700/50">
              Senior/PWD discount detail
            </p>
            <div className="space-y-1.5">
              {order.senior_pwd_details.map((entry, i) => (
                <div key={i} className="text-xs text-char-700/70">
                  <p className="font-medium text-char-800">
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

        <p className="mt-4 text-center text-xs capitalize text-char-700/40">
          Status: {order.status}
        </p>
        {order.status === "cancelled" && order.cancel_reason && (
          <p className="mt-1 text-center text-xs text-ember-600">
            Reason: {order.cancel_reason}
          </p>
        )}

        <div className="mt-5 flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-md border border-char-700/20 py-2 text-sm font-medium text-char-800 hover:bg-char-800/5"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md bg-ember-500 py-2 text-sm font-semibold text-white hover:bg-ember-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
