import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, LocateFixed, MapPin, Package, PencilLine, Tag, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, ApiError } from "../api/client";
import { AppliedPromo, CustomerProfile, MenuCategory, OrderRow } from "../api/types";
import { DeliveryTimeNotice } from "./DeliveryTimeNotice";
import { CashfreePaymentPanel } from "./CashfreePaymentPanel";
import { ConfirmOrderDialog } from "./ConfirmOrderDialog";
import { rumaliNeedsMain, useStoreStatus } from "../hooks";
import { CartLine, useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { QuantityStepper } from "./QuantityStepper";

const CASHFREE_PENDING_KEY = "cdh_cashfree_pending";
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

/** Packing charge per plate — display mirror of the backend's packingFeeFor (the backend decides what's charged). */
const PACKING_FEE_PAISE = { HALF: 500, FULL: 900, SINGLE: 0 } as const;

function estimatePackingFee(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + PACKING_FEE_PAISE[l.priceType] * l.quantity, 0);
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

/** Order lines as the API wants them, including each item's kitchen note. */
function apiItems(lines: CartLine[]) {
  return lines.map((l) => ({
    menuItemId: l.menuItemId,
    priceType: l.priceType,
    quantity: l.quantity,
    addonIds: l.addons.map((a) => a.id),
    specialInstructions: l.note?.trim() || undefined,
  }));
}

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, addItem, setQuantity, removeItem, setNote, replaceAll, totalPaise, clear } = useCart();
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const { data: menuData } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });
  const extrasItems = menuData?.categories.find((c) => c.name === "Extras")?.items.filter((i) => i.status === "ACTIVE" && !/delivery/i.test(i.name)) ?? [];
  const { phone } = useCustomerAuth();
  const { data: payConfig } = useQuery({
    queryKey: ["payment-config"],
    queryFn: () => api.get<{ cashfree: { enabled: boolean; testMode: boolean } }>("/public/orders/payment-config"),
    staleTime: 5 * 60_000,
  });
  const store = useStoreStatus();
  const categoryOf = new Map<string, string>();
  for (const c of menuData?.categories ?? []) for (const i of c.items) categoryOf.set(i.id, c.name);
  const rumaliOnly = rumaliNeedsMain(lines, categoryOf);
  // Items that sold out (or left the menu) while sitting in the cart — caught here, not as an error at checkout.
  const menuStatus = new Map<string, string>();
  for (const c of menuData?.categories ?? []) for (const i of c.items) menuStatus.set(i.id, i.status);
  const soldOutKeys = menuData ? lines.filter((l) => menuStatus.get(l.menuItemId) !== "ACTIVE").map((l) => l.key) : [];
  const blocked = !store.isOpen || rumaliOnly || soldOutKeys.length > 0;
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
  // Packing is on by default for takeaway/delivery; turning it off shows a caution.
  const [packing, setPacking] = useState(true);
  // A returning customer's name and recent addresses, so checkout is a couple of taps.
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => api.get<CustomerProfile>("/public/profile"),
    enabled: open,
    staleTime: 60_000,
  });
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || !profile) return;
    setPrefilled(true);
    if (profile.name && !customerName) setCustomerName(profile.name);
  }, [profile, prefilled, customerName]);
  const [placing, setPlacing] = useState(false);
  const [showDeliveryReview, setShowDeliveryReview] = useState(false);
  // The action to run once the customer confirms the "check your order" popup.
  // An online payment in progress (shown full-screen with a 5-minute countdown).
  const [cfPayment, setCfPayment] = useState<{
    cashfreeOrderId: string;
    paymentSessionId: string;
    mode: "sandbox" | "production";
    windowSeconds: number;
    amountPaise: number;
  } | null>(null);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const askConfirm = (action: () => void) => setConfirmAction(() => action);

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
  const packingApplies = orderType !== "DINE_IN";
  const packingFee = packingApplies && packing ? estimatePackingFee(lines) : 0;
  const discountPaise = appliedPromo?.discount_paise ?? 0;
  const grandTotal = Math.max(0, totalPaise + deliveryFee + packingFee - discountPaise);

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
    if (lines.length === 0 || blocked) return;
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
    askConfirm(() => placeOrder());
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
    paymentProvider?: "MOCK" | "COD" | "CASHFREE",
    paymentDetails?: { cashfreeOrderId: string },
    opts: { silent?: boolean } = {}
  ): Promise<boolean> {
    setPlacing(true);
    try {
      const { order } = await api.post<{ order: OrderRow }>("/public/orders", {
        ...orderPayload(),
        paymentProvider,
        ...paymentDetails,
      });
      clear();
      setCoords(null);
      removePromo();
      sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
      setShowDeliveryReview(false);
      onClose();
      navigate(`/order/${order.id}`, { state: { order } });
      return true;
    } catch (err) {
      if (!opts.silent) {
        const msg = err instanceof ApiError ? err.message : "Could not place your order. Please try again.";
        if (paymentProvider === "CASHFREE") {
          // They've paid — make it crystal clear the money isn't lost.
          setPayNotice(
            `${msg} Your payment is safe: we'll keep trying to place this order, and if it can't be placed the full amount is refunded to your UPI account automatically (3–5 working days). Check "Your orders" in a minute.`
          );
        }
        toast.error(msg);
      }
      return false;
    } finally {
      setPlacing(false);
    }
  }

  /** The whole order as the API wants it — also saved with an online payment so it can be placed even if this page is lost. */
  function orderPayload() {
    const signature = JSON.stringify({ lines, orderType, customerName, tableLabel, deliveryAddress, coords, notes, packing });
    return {
      orderType,
      customerName: customerName.trim() || undefined,
      tableLabel: orderType === "DINE_IN" ? tableLabel || undefined : undefined,
      deliveryAddress: orderType === "DELIVERY" ? deliveryAddress.trim() : undefined,
      deliveryLatitude: orderType === "DELIVERY" ? coords?.lat : undefined,
      deliveryLongitude: orderType === "DELIVERY" ? coords?.lng : undefined,
      notes: notes || undefined,
      items: apiItems(lines),
      idempotencyKey: getIdempotencyKey(signature),
      promoCode: appliedPromo?.code,
      packing: packingApplies ? packing : undefined,
    };
  }

  // Online payment through Cashfree (UPI only — apps and QR). The
  // server prices the cart and opens the Cashfree order; the customer pays in
  // Cashfree's popup; then the server asks Cashfree whether it was really paid
  // before the order is created — nothing the browser reports is trusted.
  async function payWithCashfree() {
    if (typeof window.Cashfree !== "function") {
      toast.error("Payment isn't available right now. Please try Cash on Delivery.");
      return;
    }
    const cartSignature = JSON.stringify({ lines, orderType, promo: appliedPromo?.code, packing });

    // If the customer paid earlier but the order never got created (closed the
    // tab, lost network…), claim that payment instead of charging them twice.
    try {
      const raw = sessionStorage.getItem(CASHFREE_PENDING_KEY);
      const pending = raw ? (JSON.parse(raw) as { sig: string; id: string }) : null;
      if (pending && pending.sig === cartSignature) {
        setPlacing(true);
        if (await placeOrder("CASHFREE", { cashfreeOrderId: pending.id }, { silent: true })) {
          sessionStorage.removeItem(CASHFREE_PENDING_KEY);
          return;
        }
      }
    } catch {
      // No stored attempt (or storage blocked) — carry on with a fresh payment.
    }

    setPlacing(true);
    try {
      const { cashfreeOrderId, paymentSessionId, mode, windowSeconds, amountPaise } = await api.post<{
        cashfreeOrderId: string;
        paymentSessionId: string;
        amountPaise: number;
        mode: "sandbox" | "production";
        windowSeconds: number;
      }>("/public/orders/cashfree-order", orderPayload());
      try {
        sessionStorage.setItem(CASHFREE_PENDING_KEY, JSON.stringify({ sig: cartSignature, id: cashfreeOrderId }));
      } catch {
        // Only the double-charge safety net is lost.
      }
      setPayNotice(null);
      // Hand over to the full-screen payment panel (it owns the 5-minute timer).
      setCfPayment({ cashfreeOrderId, paymentSessionId, mode, windowSeconds, amountPaise });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start payment. Please try again.");
      setPlacing(false);
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(CASHFREE_PENDING_KEY);
    } catch {
      // ignore
    }
  }

  // Payment finished (or was detected): the server double-checks with Cashfree before creating the order.
  async function onCashfreePaid() {
    const pay = cfPayment;
    setCfPayment(null);
    if (!pay) return;
    if (await placeOrder("CASHFREE", { cashfreeOrderId: pay.cashfreeOrderId })) clearPending();
  }

  // Close the payment on the server so it can't be paid afterwards. If it turns out
  // the customer did pay at the last moment, honour that and place the order.
  async function closeCashfreePayment(reason: "timeout" | "cancel") {
    const pay = cfPayment;
    setCfPayment(null);
    if (!pay) return;
    try {
      const { paid } = await api.post<{ paid: boolean }>("/public/orders/cashfree-order/cancel", { cashfreeOrderId: pay.cashfreeOrderId });
      if (paid) {
        if (await placeOrder("CASHFREE", { cashfreeOrderId: pay.cashfreeOrderId })) clearPending();
        return;
      }
    } catch {
      // Couldn't confirm the cancellation — the customer is told to contact us below if money was taken.
    }
    clearPending();
    setPlacing(false);
    if (reason === "timeout") {
      setPayNotice(
        "Payment time is over, so your order was not placed. If money was deducted, don't worry — it's refunded to your UPI account automatically (3–5 working days). You can try again."
      );
      toast.error("Payment time is over — order cancelled.");
    } else {
      toast("Payment cancelled.");
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-end sm:justify-center sm:p-4">
      <button aria-label="Close cart" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

      <div className="relative flex w-full max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          {showDeliveryReview ? (
            <button
              onClick={() => setShowDeliveryReview(false)}
              aria-label="Back"
              className="-m-2 p-2 text-stone-900 dark:text-stone-100"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Your order</h2>
          )}
          <button onClick={onClose} aria-label="Close" className="-m-2 p-2 text-stone-400">
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
              {packingFee > 0 && (
                <div className="flex justify-between text-stone-500 dark:text-stone-400">
                  <span>Packing</span>
                  <span>{formatRupees(packingFee)}</span>
                </div>
              )}
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

            {payNotice && (
              <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">{payNotice}</p>
            )}
            <DeliveryTimeNotice compact className="mt-4" />

            <div className="mt-4 space-y-2">
              <button
                onClick={() => askConfirm(() => placeOrder("COD"))}
                disabled={placing || blocked}
                className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                {placing ? "Placing order…" : "Cash on Delivery"}
              </button>
              {payConfig?.cashfree.enabled && (
                <button
                  onClick={() => askConfirm(payWithCashfree)}
                  disabled={placing || blocked}
                  className="w-full rounded-2xl border-2 border-brand-600 py-3 text-stone-900 disabled:opacity-60 dark:text-stone-100"
                >
                  <span className="block font-semibold">{placing ? "Please wait…" : `Pay ${formatRupees(grandTotal)} online`}</span>
                  <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">Pay with any UPI app or QR code</span>
                </button>
              )}
              {/* Test-only shortcut; never shown on the live site (the server rejects it there anyway). */}
              {import.meta.env.DEV && (
                <button
                  onClick={() => askConfirm(() => placeOrder("MOCK"))}
                  disabled={placing || blocked}
                  className="w-full rounded-2xl border border-stone-200 py-3 text-sm font-medium text-stone-500 disabled:opacity-60 dark:border-stone-700 dark:text-stone-400"
                >
                  {placing ? "Placing order…" : "Pay Online — mock (skip gateway)"}
                </button>
              )}
            </div>
            {payConfig?.cashfree.enabled && payConfig.cashfree.testMode && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <span className="font-semibold">Payments are in TEST mode — nothing is charged.</span> Use UPI ID{" "}
                <span className="font-mono">testsuccess@gocash</span> (success) or <span className="font-mono">testfailure@gocash</span> (failure).
              </p>
            )}
            {payConfig && !payConfig.cashfree.enabled && (
              <p className="mt-4 rounded-xl bg-stone-100 px-4 py-3 text-xs text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                Online payment isn't available right now — please choose Cash on Delivery.
              </p>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {lines.length === 0 ? (
              <p className="mt-6 text-center text-stone-400">Your cart is empty.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((l) => (
                  <div key={l.key} className="flex items-start justify-between gap-2 rounded-xl bg-stone-50 p-3 dark:bg-stone-800">
                    <div>
                      <p className="font-medium text-stone-900 dark:text-stone-100">
                        {l.name}
                        {soldOutKeys.includes(l.key) && (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">Sold out</span>
                        )}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {l.priceType} · {formatRupees(lineUnitPaise(l))}
                      </p>
                      {l.addons.length > 0 && (
                        <p className="text-xs text-stone-400">+ {l.addons.map((a) => a.name).join(", ")}</p>
                      )}
                      {editingNote === l.key ? (
                        <input
                          autoFocus
                          defaultValue={l.note ?? ""}
                          maxLength={200}
                          onBlur={(e) => {
                            setNote(l.key, e.target.value);
                            setEditingNote(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          placeholder="e.g. less spicy, no onion"
                          className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingNote(l.key)}
                          className="mt-1 inline-flex min-h-[28px] items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400"
                        >
                          <PencilLine size={12} /> {l.note ? <span className="italic text-stone-500 dark:text-stone-400">“{l.note}”</span> : "Add cooking note"}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <QuantityStepper value={l.quantity} onChange={(q) => setQuantity(l.key, q)} />
                      <button onClick={() => removeItem(l.key)} className="-mr-1 p-2 text-stone-400" aria-label="Remove item">
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
                    autoComplete="name"
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
                      <DeliveryTimeNotice className="mt-2" />
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
                      {(profile?.addresses.length ?? 0) > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Saved addresses</p>
                          {profile!.addresses.map((a) => {
                            const selected = deliveryAddress.trim() === a.address;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  setDeliveryAddress(a.address);
                                  setAddressError(null);
                                  setCoords(a.latitude != null && a.longitude != null ? { lat: a.latitude, lng: a.longitude } : null);
                                }}
                                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm ${
                                  selected
                                    ? "bg-brand-50 text-brand-800 ring-2 ring-brand-500 dark:bg-stone-800 dark:text-brand-300"
                                    : "border border-stone-200 text-stone-700 dark:border-stone-700 dark:text-stone-200"
                                }`}
                              >
                                <MapPin size={15} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{a.address}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
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

                {packingApplies && estimatePackingFee(lines) > 0 && (
                  <div>
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 dark:border-stone-700">
                      <span className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
                        <Package size={16} className="text-brand-600 dark:text-brand-400" />
                        <span>
                          <span className="font-medium">Packing</span>{" "}
                          <span className="text-stone-500 dark:text-stone-400">· {formatRupees(estimatePackingFee(lines))}</span>
                          <span className="block text-xs text-stone-400">₹5 per half plate · ₹9 per full plate</span>
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={packing}
                        onChange={(e) => setPacking(e.target.checked)}
                        className="h-5 w-5 shrink-0 accent-brand-600"
                      />
                    </label>
                    {!packing && (
                      <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <span>
                          Without packing, your food is handed over as-is. If it spills, leaks, gets cold or is damaged on the way, the
                          restaurant won't be responsible. We recommend keeping packing on.
                        </span>
                      </p>
                    )}
                  </div>
                )}

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
            {!store.isOpen && (
              <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                {store.message}
              </p>
            )}
            {soldOutKeys.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <span>Some items just sold out.</span>
                <button onClick={() => replaceAll(lines.filter((l) => !soldOutKeys.includes(l.key)))} className="min-h-[32px] rounded-full bg-red-600 px-3 font-semibold text-white">
                  Remove them
                </button>
              </div>
            )}
            {store.isOpen && rumaliOnly && (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                Rumali roti needs a Soya, Paneer or Mushroom Tandoori or Momo in your order — add one to continue.
              </p>
            )}
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {orderType === "DELIVERY" ? (packingFee > 0 ? "Total (incl. delivery & packing)" : "Total (incl. delivery)") : packingFee > 0 ? "Total (incl. packing)" : "Total"}
                {appliedPromo && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">· saved {formatRupees(discountPaise)}</span>}
              </span>
              <span className="text-lg font-bold text-stone-900 dark:text-stone-100">{formatRupees(grandTotal)}</span>
            </div>
            <button
              onClick={handleProceed}
              disabled={placing || blocked}
              className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-60"
            >
              {placing ? "Placing order…" : !store.isOpen ? "Store is closed" : "Place order"}
            </button>
          </div>
        )}
      </div>
      {cfPayment && (
        <CashfreePaymentPanel
          paymentSessionId={cfPayment.paymentSessionId}
          cashfreeOrderId={cfPayment.cashfreeOrderId}
          mode={cfPayment.mode}
          windowSeconds={cfPayment.windowSeconds}
          amountLabel={formatRupees(cfPayment.amountPaise)}
          onPaid={onCashfreePaid}
          onTimeout={() => closeCashfreePayment("timeout")}
          onCancel={() => closeCashfreePayment("cancel")}
        />
      )}
      {confirmAction && (
        <ConfirmOrderDialog
          lines={lines}
          totalPaise={grandTotal}
          orderType={orderType}
          busy={placing}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const run = confirmAction;
            setConfirmAction(null);
            run();
          }}
        />
      )}
    </div>
  );
}
