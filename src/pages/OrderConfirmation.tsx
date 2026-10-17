import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ChevronDown, Clock, MessageCircle, Phone, RotateCcw, XCircle } from "lucide-react";
import { api, ApiError } from "../api/client";
import { OrderDetailRow } from "../api/types";
import { ReadyTimer } from "../components/ReadyTimer";
import { ReviewPrompt, markReviewPrompted, wasReviewPrompted } from "../components/ReviewPrompt";
import { RateOrder } from "../components/RateOrder";
import { telHref, useBusinessInfo, whatsappHref } from "../hooks";
import { enablePush, getPushState, PushState, wasPushAsked, markPushAsked } from "../utils/push";
import logo from "../assets/logo.png";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

const DELIVERY_STEPS = ["Placed", "Accepted", "Preparing", "On the way", "Delivered"];
const PICKUP_STEPS = ["Placed", "Accepted", "Preparing", "Ready", "Done"];

function stepIndex(status: string): number {
  switch (status) {
    case "PENDING_ACCEPTANCE":
      return 0;
    case "CONFIRMED":
      return 1;
    case "PREPARING":
      return 2;
    case "READY":
    case "OUT_FOR_DELIVERY":
      return 3;
    default:
      return 4;
  }
}

const FINISHED = ["COMPLETED", "DELIVERED"];
const DEAD = ["CANCELLED", "REFUNDED"];

/** Live order status — polls every 5s while the order is moving, so the customer sees accept/deny as soon as staff act. */
export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const business = useBusinessInfo();

  const { data, error, refetch } = useQuery({
    queryKey: ["order-status", id],
    queryFn: () => api.get<{ order: OrderDetailRow }>(`/public/orders/${id}`),
    // Stop polling once nothing more can change (finished, or cancelled with the refund settled).
    refetchInterval: (q) => {
      const o = q.state.data?.order;
      if (!o) return 5000;
      if (FINISHED.includes(o.status)) return false;
      if (DEAD.includes(o.status) && o.refund_status !== "PENDING") return false;
      return DEAD.includes(o.status) ? 30_000 : 5000;
    },
    enabled: !!id,
  });
  const order = data?.order;
  const status = order?.status;
  const denied = !!status && DEAD.includes(status);
  const waiting = !status || status === "PENDING_ACCEPTANCE";
  const finished = !!status && FINISHED.includes(status);
  const isDelivery = order?.order_type === "DELIVERY";
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS;
  const step = status ? stepIndex(status) : 0;

  // Ask for a Google rating once the order is done — only once per order, and
  // only while the customer is on this screen when it flips to completed.
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => {
    if (!finished || !id || wasReviewPrompted(id)) return;
    const t = setTimeout(() => {
      markReviewPrompted(id);
      setReviewOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [finished, id]);

  // Offer order-update notifications while they wait (once per device).
  const [push, setPush] = useState<PushState | null>(null);
  useEffect(() => {
    getPushState().then(setPush).catch(() => setPush("unsupported"));
  }, []);
  const showPushCard = !!order && !finished && !denied && (push === "off" || push === "needs-install") && !wasPushAsked();
  async function turnOnPush() {
    try {
      setPush(await enablePush());
    } catch {
      setPush("unsupported");
    }
  }

  const [detailsOpen, setDetailsOpen] = useState(false);

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
    sub = "The kitchen is on it.";
    if (status === "OUT_FOR_DELIVERY") {
      headline = "Out for delivery";
      sub = "Your order is on the way.";
    } else if (status === "READY" && !isDelivery) {
      headline = "Ready!";
      sub = order?.order_type === "DINE_IN" ? "Your food is coming to your table." : "Please collect your order at the counter.";
    } else if (finished) {
      headline = isDelivery ? "Delivered" : "Order complete";
      sub = "Enjoy your meal!";
    }
  }

  const paid = order?.payment_status === "PAID";
  const supportText = order ? `Hi, I need help with my order #${order.order_number}.` : undefined;
  const callShop = telHref(business?.phone);
  const waShop = whatsappHref(business?.supportWhatsapp || business?.phone, supportText);
  const riderCall = telHref(order?.rider?.phone);

  if (error && !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-stone-950">
        <p className="text-stone-600 dark:text-stone-300">
          {error instanceof ApiError && error.status === 0 ? error.message : "Couldn't load your order."}
        </p>
        <button onClick={() => refetch()} className="min-h-[44px] rounded-full bg-brand-600 px-6 font-semibold text-white">
          Try again
        </button>
        <button onClick={() => navigate("/orders")} className="text-sm text-stone-500 underline">
          Go to your orders
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-white px-6 pb-10 pt-10 text-center dark:bg-stone-950">
      <img src={logo} alt="" className="mb-2 h-12 w-12 object-contain" />
      <Icon size={56} className={iconClass} />
      <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-stone-100 lg:text-3xl" aria-live="polite">
        {headline}
      </h1>
      {order && <p className="mt-1 text-stone-500 dark:text-stone-400">Order #{order.order_number}</p>}
      <p className="mt-2 max-w-xs text-sm text-stone-600 dark:text-stone-300 lg:max-w-md lg:text-base">{sub}</p>

      {denied && order?.refund_status && (
        <div className="mt-4 w-full max-w-xs rounded-2xl bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-800 lg:max-w-md">
          <p className="flex items-center gap-2 font-semibold">
            <RotateCcw size={16} />
            {order.refund_status === "SUCCESS" ? "Refund completed" : "Refund started"}
          </p>
          <p className="mt-0.5">
            {order.refund_status === "SUCCESS"
              ? `${formatRupees(order.refund_amount_paise ?? order.net_total_paise)} has been sent back to your UPI account.`
              : `${formatRupees(order.refund_amount_paise ?? order.net_total_paise)} is on its way back to your UPI account — usually 3–5 working days. You don't need to do anything.`}
          </p>
        </div>
      )}

      {order && <ReadyTimer order={order} />}

      {order?.rider && (
        <div className="mt-4 flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-left ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700 lg:max-w-md">
          <div>
            <p className="text-xs text-stone-500 dark:text-stone-400">Your rider</p>
            <p className="font-semibold text-stone-900 dark:text-stone-100">{order.rider.name}</p>
          </div>
          {riderCall && (
            <a href={riderCall} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white">
              <Phone size={16} /> Call
            </a>
          )}
        </div>
      )}

      {order && (
        <>
          <p className="mt-4 text-3xl font-bold text-stone-900 dark:text-stone-100">{formatRupees(order.net_total_paise)}</p>
          {order.discount_paise > 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">You saved {formatRupees(order.discount_paise)} with your coupon</p>
          )}
        </>
      )}

      {!denied && (
        <div className="mt-6 flex w-full max-w-xs items-center justify-between lg:max-w-md" aria-label={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}>
          {steps.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div className={`h-2.5 w-2.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-stone-300 dark:bg-stone-700"}`} />
              <span className={`text-[11px] ${i <= step ? "text-stone-800 dark:text-stone-200" : "text-stone-400"}`}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {waiting && (
        <p className="mt-4 max-w-xs text-xs text-stone-500 dark:text-stone-400 lg:max-w-md lg:text-sm">
          This usually takes a couple of minutes. If it isn't accepted in about 5 minutes it will be cancelled automatically
          {paid ? " and your payment refunded in full." : "."}
        </p>
      )}
      {order && !denied && !finished && (
        <p className="mt-4 max-w-xs rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-stone-800 dark:text-brand-400 lg:max-w-md">
          {paid
            ? "✓ Paid online — nothing to pay on arrival."
            : isDelivery
              ? `Please keep ${formatRupees(order.net_total_paise)} ready to pay the rider (cash or UPI).`
              : "Please pay at the counter."}
        </p>
      )}

      {showPushCard && push === "off" && (
        <div className="mt-4 flex w-full max-w-xs items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-left text-white dark:bg-stone-800 lg:max-w-md">
          <Bell size={20} className="shrink-0 text-brand-400" />
          <p className="flex-1 text-sm">Get notified when your order is accepted and on its way — even with the app closed.</p>
          <div className="flex flex-col gap-1">
            <button onClick={turnOnPush} className="min-h-[36px] rounded-full bg-brand-600 px-3 text-xs font-semibold">
              Notify me
            </button>
            <button
              onClick={() => {
                markPushAsked();
                setPush("unsupported");
              }}
              className="text-[11px] text-stone-400"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {order && finished && <RateOrder orderId={order.id} existing={order.feedback} />}

      {order && (
        <div className="mt-5 w-full max-w-xs text-left lg:max-w-md">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-stone-700 dark:text-stone-200"
          >
            Order details
            <ChevronDown size={18} className={`transition ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
          {detailsOpen && (
            <div className="space-y-2 rounded-2xl bg-stone-50 p-4 text-sm dark:bg-stone-900">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <div>
                    <p className="text-stone-800 dark:text-stone-200">
                      {item.name} × {item.quantity}
                    </p>
                    {item.addons.length > 0 && <p className="text-xs text-stone-400">+ {item.addons.map((a) => a.name).join(", ")}</p>}
                    {item.special_instructions && <p className="text-xs italic text-stone-500">“{item.special_instructions}”</p>}
                  </div>
                  <span className="tabular-nums text-stone-700 dark:text-stone-300">{formatRupees(item.line_subtotal_paise)}</span>
                </div>
              ))}
              {order.delivery_fee_paise > 0 && (
                <div className="flex justify-between text-stone-500">
                  <span>Delivery fee</span>
                  <span>{formatRupees(order.delivery_fee_paise)}</span>
                </div>
              )}
              {order.delivery_address && <p className="border-t border-stone-200 pt-2 text-xs text-stone-500 dark:border-stone-700">Deliver to: {order.delivery_address}</p>}
            </div>
          )}
        </div>
      )}

      {(callShop || waShop) && (
        <div className="mt-5 w-full max-w-xs lg:max-w-md">
          <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">Problem with your order?</p>
          <div className="grid grid-cols-2 gap-2">
            {callShop && (
              <a href={callShop} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-stone-200 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200">
                <Phone size={16} /> Call us
              </a>
            )}
            {waShop && (
              <a
                href={waShop}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
              >
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      )}

      {reviewOpen && <ReviewPrompt delivered={isDelivery} onClose={() => setReviewOpen(false)} />}

      <button onClick={() => navigate("/menu")} className="mt-8 min-h-[48px] rounded-full bg-brand-600 px-8 font-semibold text-white">
        {denied ? "Try again" : "Order more"}
      </button>
    </div>
  );
}
