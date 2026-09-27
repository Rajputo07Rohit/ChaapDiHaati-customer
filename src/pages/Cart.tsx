import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "../api/client";
import { OrderRow } from "../api/types";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { QuantityStepper } from "../components/QuantityStepper";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function Cart() {
  const { lines, setQuantity, removeItem, totalPaise, clear } = useCart();
  const { isVerified } = useCustomerAuth();
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("TAKEAWAY");
  const [tableLabel, setTableLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  async function handleProceed() {
    if (lines.length === 0) return;
    if (!isVerified) {
      navigate("/verify", { state: { returnTo: "/cart" } });
      return;
    }
    await placeOrder();
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const { order } = await api.post<{ order: OrderRow }>("/public/orders", {
        orderType,
        tableLabel: orderType === "DINE_IN" ? tableLabel || undefined : undefined,
        notes: notes || undefined,
        items: lines.map((l) => ({ menuItemId: l.menuItemId, priceType: l.priceType, quantity: l.quantity })),
      });
      clear();
      navigate(`/order/${order.id}`, { state: { order } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="min-h-screen pb-32">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <button onClick={() => navigate("/menu")} aria-label="Back to menu">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-semibold text-stone-900">Your order</h1>
      </header>

      <main className="px-4 py-4">
        {lines.length === 0 ? (
          <p className="mt-10 text-center text-stone-400">Your cart is empty.</p>
        ) : (
          <div className="space-y-3">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                <div>
                  <p className="font-medium text-stone-900">{l.name}</p>
                  <p className="text-xs text-stone-500">
                    {l.priceType} · {formatRupees(l.unitPricePaise)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <QuantityStepper value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />
                  <button onClick={() => removeItem(l.key)} className="text-stone-400" aria-label="Remove item">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">Order type</p>
              <div className="flex gap-2">
                {(["DINE_IN", "TAKEAWAY"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                      orderType === t ? "bg-brand-600 text-white" : "bg-white text-stone-600 border border-stone-200"
                    }`}
                  >
                    {t === "DINE_IN" ? "Dine-in" : "Takeaway"}
                  </button>
                ))}
              </div>
              {orderType === "DINE_IN" && (
                <input
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  placeholder="Table number (optional)"
                  className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
                />
              )}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for the kitchen? (optional)"
              className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm"
              rows={2}
            />

            <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs text-stone-500">
              Pay at the counter when your order is ready — no online payment needed for dine-in/takeaway.
            </p>
          </div>
        )}
      </main>

      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-lg font-bold text-stone-900">{formatRupees(totalPaise)}</span>
          </div>
          <button
            onClick={handleProceed}
            disabled={placing}
            className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
          >
            {placing ? "Placing order…" : "Place order"}
          </button>
        </div>
      )}
    </div>
  );
}
