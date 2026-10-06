import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LocateFixed, Tag, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "../api/client";
import { AppliedPromo, MenuCategory, OrderRow } from "../api/types";
import { CartLine, useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { QuantityStepper } from "./QuantityStepper";

const IDEMPOTENCY_STORAGE_KEY = "cdh_order_idempotency";

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

/** Unit price including this line's selected add-ons. */
function lineUnitPaise(l: CartLine): number {
  return l.unitPricePaise + l.addons.reduce((s, a) => s + a.pricePaise, 0);
}

const FREE_DELIVERY_THRESHOLD_PAISE = 15000;

/**
 * Client-side mirror of the backend's tiers, for display only — the
 * backend recomputes this itself and is the only source that actually
 * decides the payable amount.
 */
function estimateDeliveryFee(subtotalPaise: number): number {
  if (subtotalPaise < 10000) return 4000;
  if (subtotalPaise < FREE_DELIVERY_THRESHOLD_PAISE) return 3000;
  return 0;
}

/**
 * One idempotency key per distinct cart — a page refresh or double-tap
 * mid-submit reuses the same key (so the backend returns the order already
 * created for it instead of making a second one); changing the cart after
 * a submit mints a fresh key for the new attempt.
 */
function getIdempotencyKey(signature: string): string {
  try {
    const raw = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as { signature: string; key: string }) : null;
    if (stored?.signature === signature) return stored.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify({ signature, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, addItem, setQuantity, removeItem, totalPaise, clear } = useCart();
  const { data: menuData } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });
  const extrasItems = menuData?.categories.find((c) => c.name === "Extras")?.items.filter((i) => i.status === "ACTIVE") ?? [];
  const { phone } = useCustomerAuth();
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState<OrderType>("TAKEAWAY");
  const [customerName, setCustomerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [showDeliveryReview, setShowDeliveryReview] = useState(false);

  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoAppliedForSubtotal, setPromoAppliedForSubtotal] = useState<number | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  // The cart changed since this code was applied (items/quantities edited) —
  // the discount shown would be stale, and the backend would just re-reject
  // or recompute it differently at order time. Drop it and ask again rather
  // than show a number that won't match what's actually charged.
  useEffect(() => {
    if (appliedPromo && promoAppliedForSubtotal !== null && promoAppliedForSubtotal !== totalPaise) {
      setAppliedPromo(null);
      setPromoAppliedForSubtotal(null);
      toast("Cart changed — please re-apply your coupon.", { icon: "ℹ️" });
    }
  }, [totalPaise, appliedPromo, promoAppliedForSubtotal]);

  if (!open) return null;

  const deliveryFee = orderType === "DELIVERY" ? estimateDeliveryFee(totalPaise) : 0;
  const discountPaise = appliedPromo?.discount_paise ?? 0;
  const grandTotal = Math.max(0, totalPaise + deliveryFee - discountPaise);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setApplyingPromo(true);
    setPromoError(null);
    try {
      const result = await api.post<AppliedPromo>("/public/promo-codes/validate", { code, subtotalPaise: totalPaise });
      setAppliedPromo(result);
      setPromoAppliedForSubtotal(totalPaise);
      toast.success(`"${result.code}" applied`);
    } catch (err) {
      setPromoError(err instanceof ApiError ? err.message : "Could not apply this code.");
    } finally {
      setApplyingPromo(false);
    }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoAppliedForSubtotal(null);
    setPromoInput("");
    setPromoError(null);
  }

  function handleProceed() {
    if (lines.length === 0) return;
    if (!customerName.trim()) {
      setNameError("Please enter your name.");
      return;
    }
    if (orderType === "DELIVERY" && !deliveryAddress.trim()) {
      setAddressError("Please enter a delivery address.");
      return;
    }
    if (orderType === "DELIVERY") {
      setShowDeliveryReview(true);
      return;
    }
    placeOrder();
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device/browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location shared — add a landmark below to help the rider.");
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission was denied." : "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function placeOrder(
    paymentProvider?: "MOCK" | "COD" | "RAZORPAY",
    razorpayDetails?: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  ) {
    setPlacing(true);
    const signature = JSON.stringify({ lines, orderType, customerName, tableLabel, deliveryAddress, coords, notes });
    try {
      const { order } = await api.post<{ order: OrderRow }>("/public/orders", {
        orderType,
        customerName: customerName.trim() || undefined,
        tableLabel: orderType === "DINE_IN" ? tableLabel || undefined : undefined,
        deliveryAddress: orderType === "DELIVERY" ? deliveryAddress.trim() : undefined,
        deliveryLatitude: orderType === "DELIVERY" ? coords?.lat : undefined,
        deliveryLongitude: orderType === "DELIVERY" ? coords?.lng : undefined,
        paymentProvider,
        ...razorpayDetails,
        notes: notes || undefined,
        items: lines.map((l) => ({ menuItemId: l.menuItemId, priceType: l.priceType, quantity: l.quantity, addonIds: l.addons.map((a) => a.id) })),
        idempotencyKey: getIdempotencyKey(signature),
        promoCode: appliedPromo?.code,
      });
      clear();
      setCoords(null);
      removePromo();
      sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
      setShowDeliveryReview(false);
      onClose();
      navigate(`/order/${order.id}`, { state: { order } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  async function payWithRazorpay() {
    if (typeof window.Razorpay === "undefined") {
      toast.error("Payment isn't available right now. Please try Cash on Delivery.");
      return;
    }
    setPlacing(true);
    try {
      const { razorpayOrderId, amountPaise, keyId } = await api.post<{
        razorpayOrderId: string;
        amountPaise: number;
        keyId: string;
      }>("/public/orders/razorpay-order", {
        orderType,
        items: lines.map((l) => ({ menuItemId: l.menuItemId, priceType: l.priceType, quantity: l.quantity, addonIds: l.addons.map((a) => a.id) })),
        promoCode: appliedPromo?.code,
      });

      const razorpay = new window.Razorpay({
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        name: "Chaap Di Haati (Test Mode)",
        description: "Delivery order",
        order_id: razorpayOrderId,
        prefill: phone ? { contact: phone } : undefined,
        theme: { color: "#ea580c" },
        handler: (response) => {
          placeOrder("RAZORPAY", {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => setPlacing(false),
        },
      });
      razorpay.open();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start payment. Please try again.");
      setPlacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-end">
      <button aria-label="Close cart" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 sm:max-w-md">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          {showDeliveryReview ? (
            <button
              onClick={() => setShowDeliveryReview(false)}
              aria-label="Back"
              className="text-stone-900 dark:text-stone-100"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Your order</h2>
          )}
          <button onClick={onClose} aria-label="Close" className="text-stone-400">
            <X size={20} />
          </button>
        </div>

        {showDeliveryReview ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">Review &amp; pay</h3>
            <div className="mt-3 space-y-2">
              {lines.map((l) => (
                <div key={l.key} className="flex justify-between text-sm text-stone-600 dark:text-stone-300">
                  <span>
                    {l.name}
                    {l.addons.length > 0 && <span className="text-stone-400"> ({l.addons.map((a) => a.name).join(", ")})</span>} ×{" "}
                    {l.quantity}
                  </span>
                  <span>{formatRupees(lineUnitPaise(l) * l.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm dark:border-stone-800">
              <div className="flex justify-between text-stone-500 dark:text-stone-400">
                <span>Subtotal</span>
                <span>{formatRupees(totalPaise)}</span>
              </div>
              <div className="flex justify-between text-stone-500 dark:text-stone-400">
                <span>Delivery fee</span>
                <span>{deliveryFee === 0 ? "Free" : formatRupees(deliveryFee)}</span>
              </div>
              {appliedPromo && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Coupon ({appliedPromo.code})</span>
                  <span>-{formatRupees(discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-semibold text-stone-900 dark:text-stone-100">
                <span>Total</span>
                <span>{formatRupees(grandTotal)}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => placeOrder("COD")}
                disabled={placing}
                className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                {placing ? "Placing order…" : "Cash on Delivery"}
              </button>
              <button
                onClick={payWithRazorpay}
                disabled={placing}
                className="w-full rounded-2xl border border-stone-200 py-3.5 font-semibold text-stone-700 disabled:opacity-60 dark:border-stone-700 dark:text-stone-200"
              >
                {placing ? "Please wait…" : `Pay ${formatRupees(grandTotal)} with Razorpay (Test Mode)`}
              </button>
              <button
                onClick={() => placeOrder("MOCK")}
                disabled={placing}
                className="w-full rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-500 disabled:opacity-60 dark:border-stone-700 dark:text-stone-400"
              >
                {placing ? "Placing order…" : "Pay Online — mock (skip gateway)"}
              </button>
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Razorpay is running in test mode — use card 4111 1111 1111 1111, any future expiry/CVV, to simulate a
              real payment. Nothing is actually charged. "Mock" skips the gateway entirely for quick testing.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {lines.length === 0 ? (
              <p className="mt-6 text-center text-stone-400">Your cart is empty.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => (
                  <div key={l.key} className="flex items-center justify-between rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">{l.name}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {l.priceType} · {formatRupees(lineUnitPaise(l))}
                      </p>
                      {l.addons.length > 0 && (
                        <p className="text-xs text-stone-400">+ {l.addons.map((a) => a.name).join(", ")}</p>
                      )}
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

            {lines.length > 0 && extrasItems.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 text-xs text-stone-400">Quick add:</span>
                {extrasItems.map((item) => {
                  const price = item.prices.find((p) => p.price_type === "SINGLE") ?? item.prices[0];
                  if (!price) return null;
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        addItem({ menuItemId: item.id, name: item.name, priceType: price.price_type, unitPricePaise: price.price_paise, addons: [] }, 1)
                      }
                      className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 active:scale-95 dark:bg-stone-800 dark:text-stone-200"
                    >
                      + {item.name} ({formatRupees(price.price_paise)})
                    </button>
                  );
                })}
              </div>
            )}

            {lines.length > 0 && (
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Your name</p>
                  <input
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setNameError(null);
                    }}
                    placeholder="Your name"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm dark:bg-stone-800 dark:text-stone-100 ${
                      nameError ? "border-red-400" : "border-stone-200 dark:border-stone-700"
                    }`}
                  />
                  {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Order type</p>
                  <div className="flex gap-2">
                    {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setOrderType(t);
                          setAddressError(null);
                          setNameError(null);
                        }}
                        className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                          orderType === t
                            ? "bg-brand-600 text-white"
                            : "border border-stone-200 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                        }`}
                      >
                        {t === "DINE_IN" ? "Dine-in" : t === "TAKEAWAY" ? "Takeaway" : "Delivery"}
                      </button>
                    ))}
                  </div>
                  {orderType === "DINE_IN" && (
                    <input
                      value={tableLabel}
                      onChange={(e) => setTableLabel(e.target.value)}
                      placeholder="Table number (optional)"
                      className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                  )}
                  {orderType === "DELIVERY" && (
                    <>
                      <button
                        type="button"
                        onClick={shareLocation}
                        disabled={locating}
                        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60 ${
                          coords
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "border border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300"
                        }`}
                      >
                        <LocateFixed size={16} />
                        {locating ? "Getting location…" : coords ? "Location shared ✓" : "Use my current location"}
                      </button>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => {
                          setDeliveryAddress(e.target.value);
                          setAddressError(null);
                        }}
                        placeholder="House/flat, street, landmark"
                        rows={2}
                        className={`mt-2 w-full rounded-xl border px-4 py-2.5 text-sm dark:bg-stone-800 dark:text-stone-100 ${
                          addressError ? "border-red-400" : "border-stone-200 dark:border-stone-700"
                        }`}
                      />
                      {addressError && <p className="mt-1 text-xs text-red-500">{addressError}</p>}
                      {deliveryFee > 0 ? (
                        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Delivery fee {formatRupees(deliveryFee)} · add{" "}
                          {formatRupees(FREE_DELIVERY_THRESHOLD_PAISE - totalPaise)} more for free delivery
                        </p>
                      ) : (
                        <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          🎉 You've got free delivery on this order!
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-stone-700 dark:text-stone-300">Coupon</p>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 dark:bg-emerald-900/30">
                      <div className="flex items-center gap-2 text-sm">
                        <Tag size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{appliedPromo.code}</span>
                        <span className="text-emerald-600 dark:text-emerald-400">-{formatRupees(appliedPromo.discount_paise)}</span>
                      </div>
                      <button onClick={removePromo} className="text-xs font-semibold text-emerald-700 underline dark:text-emerald-400">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.toUpperCase());
                          setPromoError(null);
                        }}
                        placeholder="Enter coupon code"
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm uppercase dark:bg-stone-800 dark:text-stone-100 ${
                          promoError ? "border-red-400" : "border-stone-200 dark:border-stone-700"
                        }`}
                      />
                      <button
                        onClick={applyPromo}
                        disabled={!promoInput.trim() || applyingPromo}
                        className="shrink-0 rounded-xl bg-stone-800 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-stone-700"
                      >
                        {applyingPromo ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {promoError && <p className="mt-1 text-xs text-red-500">{promoError}</p>}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for the kitchen? (optional)"
                  className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                  rows={2}
                />

                <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                  {orderType === "DELIVERY"
                    ? "Choose Cash on Delivery or pay online on the next step."
                    : "Pay at the counter when your order is ready — no online payment needed."}
                </p>
              </div>
            )}
          </div>
        )}

        {lines.length > 0 && !showDeliveryReview && (
          <div className="border-t border-stone-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-stone-800">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {orderType === "DELIVERY" ? "Total (incl. delivery)" : "Total"}
                {appliedPromo && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">· saved {formatRupees(discountPaise)}</span>}
              </span>
              <span className="text-lg font-bold text-stone-900 dark:text-stone-100">{formatRupees(grandTotal)}</span>
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
    </div>
  );
}
