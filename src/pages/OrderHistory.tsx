import { useState } from "react";
import { ReadyTimer } from "../components/ReadyTimer";
import { useReviewUrl } from "../components/ReviewPrompt";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Package, RotateCcw, ShoppingBag, Star } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { MenuCategory, OrderDetailRow, OrderRow } from "../api/types";
import { useCart } from "../context/CartContext";
import { buildReorderCart } from "../utils/reorder";
import { RateOrder } from "../components/RateOrder";

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

/** True while staff can still change this order (status moving, or a refund still settling) — so it's worth polling. */
function isLive(o: Pick<OrderRow, "status" | "refund_status">): boolean {
  if (o.status === "COMPLETED" || o.status === "DELIVERED") return false;
  if (o.status === "CANCELLED" || o.status === "REFUNDED") return o.refund_status === "PENDING";
  return true;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, className: "bg-stone-200 text-stone-600" };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className}`}>{s.label}</span>;
}

/** Refund line for a cancelled order that was paid online. */
function RefundNote({ order }: { order: Pick<OrderRow, "refund_status" | "refund_amount_paise" | "net_total_paise"> }) {
  if (!order.refund_status) return null;
  const amount = formatRupees(order.refund_amount_paise ?? order.net_total_paise);
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <RotateCcw size={12} />
      {order.refund_status === "SUCCESS" ? `${amount} refunded to your UPI` : `Refund of ${amount} on its way (3–5 working days)`}
    </p>
  );
}

function OrderDetailSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-order-detail", orderId],
    queryFn: () => api.get<{ order: OrderDetailRow }>(`/public/orders/${orderId}`),
    // Live status while it's open; stops once nothing more can change.
    refetchInterval: (q) => (!q.state.data || isLive(q.state.data.order) ? 5000 : false),
  });
  const order = data?.order;
  const reviewUrl = useReviewUrl();
  const navigate = useNavigate();
  const { lines: cartLines, replaceAll } = useCart();
  const { data: menu } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });

  function reorder() {
    if (!order || !menu) return;
    const { lines, skipped } = buildReorderCart(order.items, menu.categories);
    if (lines.length === 0) {
      toast.error("None of these items are available right now.");
      return;
    }
    if (cartLines.length > 0 && !window.confirm("Replace the items already in your cart with this order?")) return;
    replaceAll(lines);
    if (skipped.length > 0) toast(`Not available now: ${skipped.join(", ")}`, { icon: "ℹ️", duration: 5000 });
    else toast.success("Added to your cart at today's prices.");
    navigate("/menu");
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-end sm:justify-center sm:p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            {order ? `Order #${order.order_number}` : "Order"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-stone-400">
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
              <div className="flex justify-center">
                <ReadyTimer order={order} />
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
                  <RefundNote order={order} />
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
                      {item.special_instructions && <p className="text-xs italic text-stone-500">“{item.special_instructions}”</p>}
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
                {(order.packing_fee_paise ?? 0) > 0 && (
                  <div className="flex justify-between text-stone-500 dark:text-stone-400">
                    <span>Packing</span>
                    <span>{formatRupees(order.packing_fee_paise!)}</span>
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
              {(order.status === "COMPLETED" || order.status === "DELIVERED") && (
                <div className="flex justify-center">
                  <RateOrder orderId={order.id} existing={order.feedback} />
                </div>
              )}
              <button
                onClick={reorder}
                disabled={!menu}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 font-semibold text-white disabled:opacity-60"
              >
                <ShoppingBag size={18} /> Reorder
              </button>
              {(order.status === "COMPLETED" || order.status === "DELIVERED") && reviewUrl && (
                <a
                  href={reviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-amber-50 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/60"
                >
                  <Star size={16} className="fill-amber-400 text-amber-400" /> Rate us on Google
                </a>
              )}
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => api.get<{ orders: OrderRow[] }>("/public/orders"),
    // Keep statuses live while any order is still in progress (accepted, ready, refund settling…).
    refetchInterval: (q) => (q.state.data?.orders.some(isLive) ? 5000 : false),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="min-h-screen bg-stone-50 pb-10 dark:bg-stone-950">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:bg-stone-900/95 lg:px-8 lg:py-4">
        <button onClick={() => navigate("/menu")} aria-label="Back" className="-m-2 p-2 text-stone-700 dark:text-stone-200">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-stone-900 dark:text-stone-100 lg:text-xl">Your Orders</h1>
      </header>

      <main className="px-4 py-4 lg:px-8 lg:py-6">
        {isLoading && <p className="mt-8 text-center text-stone-400">Loading…</p>}
        {isError && !data && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center text-stone-500">
            <p>Couldn't load your orders. Please check your connection.</p>
            <button onClick={() => refetch()} className="min-h-[44px] rounded-full bg-brand-600 px-5 font-semibold text-white">
              Try again
            </button>
          </div>
        )}
        {!isLoading && !isError && orders.length === 0 && (
          <div className="mt-16 flex flex-col items-center text-stone-400">
            <Package size={40} className="mb-2 opacity-40" />
            <p>No orders yet.</p>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o.id)}
              className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-700 dark:bg-stone-800"
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
                <RefundNote order={o} />
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
