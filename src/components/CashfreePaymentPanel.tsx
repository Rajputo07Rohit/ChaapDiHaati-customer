import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, X } from "lucide-react";
import { api } from "../api/client";

function mmss(totalSeconds: number): string {
  const t = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(t / 60)).padStart(1, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Full-screen payment step with a hard time limit. Cashfree's checkout is
 * embedded inline (not their popup) so this screen controls it: when the
 * countdown hits 0:00 the parent cancels the payment and this panel is removed
 * — the customer can no longer pay. A background status check also notices a
 * payment made another way (e.g. a QR scanned on a second phone).
 */
export function CashfreePaymentPanel({
  paymentSessionId,
  cashfreeOrderId,
  mode,
  windowSeconds,
  amountLabel,
  onPaid,
  onTimeout,
  onCancel,
}: {
  paymentSessionId: string;
  cashfreeOrderId: string;
  mode: "sandbox" | "production";
  windowSeconds: number;
  amountLabel: string;
  onPaid: () => void;
  onTimeout: () => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const [deadline] = useState(() => Date.now() + windowSeconds * 1000);
  const [left, setLeft] = useState(windowSeconds);
  const [loadError, setLoadError] = useState(false);

  // Run the callback once, whichever of paid / timeout / cancel happens first.
  function finish(cb: () => void) {
    if (doneRef.current) return;
    doneRef.current = true;
    cb();
  }

  // Open Cashfree's checkout inside our container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window.Cashfree !== "function") {
      setLoadError(true);
      return;
    }
    const cashfree = window.Cashfree({ mode });
    const open = (withSize: boolean) =>
      cashfree.checkout({
        paymentSessionId,
        redirectTarget: el,
        ...(withSize ? { appearance: { width: "100%", height: "600px" } } : {}),
      });
    open(true)
      .catch(() => open(false))
      .then((result) => {
        // A failed attempt shows its own message inside the widget and the customer can retry
        // until the timer ends, so only a clean result counts as "paid" here.
        if (result && !result.error) finish(onPaid);
      })
      .catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown.
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = (deadline - Date.now()) / 1000;
      setLeft(remaining);
      if (remaining <= 0) finish(onTimeout);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backstop: notice a payment the widget didn't report.
  const { data: status } = useQuery({
    queryKey: ["cashfree-status", cashfreeOrderId],
    queryFn: () => api.get<{ paid: boolean }>(`/public/orders/cashfree-order/${cashfreeOrderId}/status`),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    retry: false,
  });
  useEffect(() => {
    if (status?.paid) finish(onPaid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.paid]);

  const urgent = left <= 60;
  const pct = Math.max(0, Math.min(100, (left / windowSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-stone-950" role="dialog" aria-modal="true" aria-label="Complete your payment">
      <header className="border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-stone-900 dark:text-stone-100">Complete your payment · {amountLabel}</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">Pay with any UPI app or scan the QR. Your order is placed once payment succeeds.</p>
          </div>
          <div
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
              urgent ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            }`}
            aria-live="off"
          >
            <Clock3 size={14} /> {mmss(left)}
          </div>
        </div>
        <div className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
          <div className={`h-full transition-[width] duration-200 ${urgent ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mx-auto mt-2 max-w-lg text-xs text-stone-500 dark:text-stone-400">
          Please pay within {Math.round(windowSeconds / 60)} minutes. If the time runs out, the payment is cancelled and your order will not be placed.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {loadError ? (
          <p className="mx-auto mt-10 max-w-sm px-6 text-center text-sm text-red-600">
            The payment page couldn't load. Please cancel and try again, or choose Cash on Delivery.
          </p>
        ) : (
          <div ref={containerRef} className="mx-auto w-full max-w-lg" />
        )}
      </div>

      <footer className="border-t border-stone-200 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-stone-800 dark:bg-stone-900">
        <button
          onClick={() => finish(onCancel)}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-2xl border border-stone-300 py-3 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:text-stone-200"
        >
          <X size={16} /> Cancel payment
        </button>
      </footer>
    </div>
  );
}
