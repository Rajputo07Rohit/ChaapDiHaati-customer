import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Package } from "lucide-react";
import { api } from "../api/client";
import { OrderDetailRow, OrderRow } from "../api/types";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING_ACCEPTANCE: { label: "Waiting for restaurant", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  CONFIRMED: { label: "Confirmed", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  PREPARING: { label: "Preparing", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  READY: { label: "Ready", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  REFUNDED: { label: "Refunded", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, className: "bg-stone-200 text-stone-600" };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

function OrderDetailSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-order-detail", orderId],
    queryFn: () => api.get<{ order: OrderDetailRow }>(`/public/orders/${orderId}`),
  });
  const order = data?.order;

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 sm:max-w-md">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            {order ? `Order #${order.order_number}` : "Order"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-stone-400">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && <p className="text-center text-stone-400">Loading…</p>}
          {order && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <StatusBadge status={order.status} />
                <span className="text-xs text-stone-500 dark:text-stone-400">{formatDate(order.created_at)}</span>
              </div>
              {order.delivery_address && (
                <p className="text-sm text-stone-600 dark:text-stone-300">{order.delivery_address}</p>
              )}
              {order.cancel_reason && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <p className="font-semibold">
                    {order.status === "REFUNDED" ? "Refunded" : "Order cancelled"}
                  </p>
                  <p className="mt-0.5">{order.cancel_reason}</p>
                </div>
              )}
              <div className="space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div>
                      <p className="text-stone-800 dark:text-stone-200">
                        {item.name} ({item.price_type}) × {item.quantity}
                      </p>
                      {item.addons.length > 0 && (
                        <p className="text-xs text-stone-400">+ {item.addons.map((a) => a.name).join(", ")}</p>
                      )}
                    </div>
                    <span className="tabular-nums text-stone-700 dark:text-stone-300">{formatRupees(item.line_subtotal_paise)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t border-stone-100 pt-3 text-sm dark:border-stone-800">
                <div className="flex justify-between text-stone-500 dark:text-stone-400">
                  <span>Subtotal</span>
                  <span>{formatRupees(order.subtotal_paise)}</span>
                </div>
                {order.delivery_fee_paise > 0 && (
                  <div className="flex justify-between text-stone-500 dark:text-stone-400">
                    <span>Delivery fee</span>
                    <span>{formatRupees(order.delivery_fee_paise)}</span>
                  </div>
                )}
                {order.discount_paise > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Coupon discount</span>
                    <span>-{formatRupees(order.discount_paise)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 font-semibold text-stone-900 dark:text-stone-100">
                  <span>Total</span>
                  <span>{formatRupees(order.net_total_paise)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderHistory() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => api.get<{ orders: OrderRow[] }>("/public/orders"),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="min-h-screen bg-stone-50 pb-10 dark:bg-stone-950">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:bg-stone-900/95">
        <button onClick={() => navigate("/menu")} aria-label="Back" className="text-stone-700 dark:text-stone-200">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-stone-900 dark:text-stone-100">Your Orders</h1>
      </header>

      <main className="px-4 py-4">
        {isLoading && <p className="mt-8 text-center text-stone-400">Loading…</p>}
        {!isLoading && orders.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-stone-400">
            <Package size={40} className="mb-2 opacity-40" />
            <p>No orders yet.</p>
          </div>
        )}
        <div className="space-y-3">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm dark:border-stone-700 dark:bg-stone-800"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900 dark:text-stone-100">Order #{o.order_number}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  {o.order_type.replace("_", "-")} · {formatDate(o.created_at)}
                </p>
                {o.cancel_reason && <p className="mt-1 text-xs text-red-500">Reason: {o.cancel_reason}</p>}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-stone-900 dark:text-stone-100">{formatRupees(o.net_total_paise)}</span>
                <ChevronRight size={16} className="text-stone-300" />
              </div>
            </button>
          ))}
        </div>
      </main>

      {selected && <OrderDetailSheet orderId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
