import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { api } from "../api/client";
import { OrderRow } from "../api/types";
import logo from "../assets/logo.png";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

const STEPS = ["Placed", "Accepted", "Preparing", "On the way", "Done"];

function stepIndex(status: string): number {
  switch (status) {
    case "PENDING_ACCEPTANCE":
      return 0;
    case "CONFIRMED":
      return 1;
    case "PREPARING":
    case "READY":
      return 2;
    case "OUT_FOR_DELIVERY":
      return 3;
    default:
      return 4;
  }
}

/** Live order status — polls every 5s so the customer sees accept/deny as soon as staff act. */
export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["order-status", id],
    queryFn: () => api.get<{ order: OrderRow }>(`/public/orders/${id}`),
    refetchInterval: 5000,
    enabled: !!id,
  });
  const order = data?.order;
  const status = order?.status;
  const denied = status === "CANCELLED" || status === "REFUNDED";
  const waiting = !status || status === "PENDING_ACCEPTANCE";
  const step = status ? stepIndex(status) : 0;

  let headline = "Order placed!";
  let sub = "Waiting for the restaurant to accept your order…";
  let Icon = Clock;
  let iconClass = "text-amber-500 animate-pulse";
  if (denied) {
    headline = "Order not accepted";
    sub = order?.cancel_reason ?? "The restaurant could not take your order.";
    Icon = XCircle;
    iconClass = "text-red-500";
  } else if (!waiting) {
    Icon = CheckCircle2;
    iconClass = "text-brand-600";
    headline = "Order accepted!";
    sub = order?.prep_time_minutes ? `Ready in about ${order.prep_time_minutes} min` : "The kitchen is on it.";
    if (status === "OUT_FOR_DELIVERY") {
      headline = "Out for delivery";
      sub = "Your order is on the way.";
    } else if (step >= 4) {
      headline = "Order complete";
      sub = "Enjoy your meal!";
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-stone-950">
      <img src={logo} alt="" className="mb-2 h-12 w-12 object-contain" />
      <Icon size={56} className={iconClass} />
      <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-stone-100">{headline}</h1>
      {order && <p className="mt-1 text-stone-500 dark:text-stone-400">Order #{order.order_number}</p>}
      <p className="mt-2 max-w-xs text-sm text-stone-600 dark:text-stone-300">{sub}</p>
      {order && (
        <>
          <p className="mt-4 text-3xl font-bold text-stone-900 dark:text-stone-100">{formatRupees(order.net_total_paise)}</p>
          {order.discount_paise > 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              You saved {formatRupees(order.discount_paise)} with your coupon
            </p>
          )}
        </>
      )}

      {!denied && (
        <div className="mt-6 flex w-full max-w-xs items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div className={`h-2.5 w-2.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-stone-300 dark:bg-stone-700"}`} />
              <span className={`text-[10px] ${i <= step ? "text-stone-800 dark:text-stone-200" : "text-stone-400"}`}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {waiting && (
        <p className="mt-4 max-w-xs text-xs text-stone-500 dark:text-stone-400">
          This usually takes a couple of minutes. If it isn't accepted in about 5 minutes it will be cancelled automatically.
        </p>
      )}
      {status === "PENDING_ACCEPTANCE" || status === "CONFIRMED" ? (
        <p className="mt-4 max-w-xs rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-stone-800 dark:text-brand-400">
          Please pay at the counter / on delivery unless you already paid online.
        </p>
      ) : null}

      <button onClick={() => navigate("/menu")} className="mt-8 rounded-full bg-brand-600 px-8 py-3 font-semibold text-white">
        {denied ? "Try again" : "Order more"}
      </button>
    </div>
  );
}
