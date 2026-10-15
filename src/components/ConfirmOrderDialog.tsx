import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { DeliveryTimeNotice } from "./DeliveryTimeNotice";
import { CartLine } from "../context/CartContext";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

const ORDER_TYPE_LABEL: Record<string, string> = { DINE_IN: "Dine-in", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

/** Last stop before an order is actually submitted/charged: shows exactly
 * what will be sent and warns that an accepted order can't be changed. */
export function ConfirmOrderDialog({
  lines,
  totalPaise,
  orderType,
  busy,
  onCancel,
  onConfirm,
}: {
  lines: CartLine[];
  totalPaise: number;
  orderType: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Confirm your order">
      <button aria-label="Close" onClick={onCancel} disabled={busy} className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
      <div className="cdh-rise relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-stone-900 sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Check your order before placing</h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">Order dene se pehle ek baar zaroor check kar lein.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-stone-50 p-3 dark:bg-stone-800">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-stone-400">
            <span>{ORDER_TYPE_LABEL[orderType] ?? orderType}</span>
            <span>{lines.reduce((n, l) => n + l.quantity, 0)} items</span>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-stone-800 dark:text-stone-200">
            {lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {l.name}
                  {l.priceType !== "SINGLE" && <span className="text-stone-400"> ({l.priceType === "HALF" ? "Half" : "Full"})</span>}
                  {l.addons.length > 0 && <span className="block text-xs text-stone-400">+ {l.addons.map((a) => a.name).join(", ")}</span>}
                </span>
                <span className="shrink-0 font-semibold">× {l.quantity}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 dark:border-stone-700">
            <span className="text-sm text-stone-500 dark:text-stone-400">Total</span>
            <span className="text-lg font-bold text-stone-900 dark:text-stone-100">{formatRupees(totalPaise)}</span>
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3 text-sm font-medium text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          Please note and check the order before placing. Once placed and accepted by the restaurant, it cannot be cancelled or modified.
          <span className="mt-1 block text-xs font-normal opacity-80">
            Restaurant ke accept karne ke baad order cancel ya change nahi ho sakega.
          </span>
        </p>

        {orderType === "DELIVERY" && <DeliveryTimeNotice compact className="mt-3" />}

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-2xl border border-stone-200 py-3.5 font-semibold text-stone-700 disabled:opacity-60 dark:border-stone-700 dark:text-stone-200"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-[1.4] rounded-2xl bg-brand-600 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Placing…" : "Confirm & place order"}
          </button>
        </div>
      </div>
    </div>
  );
}
