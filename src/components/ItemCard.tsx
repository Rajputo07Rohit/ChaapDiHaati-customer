import { useState } from "react";
import { UtensilsCrossed, X } from "lucide-react";
import { MenuItemAddonRow, MenuItemRow, PriceType } from "../api/types";
import { useCart } from "../context/CartContext";
import { QuantityStepper } from "./QuantityStepper";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

interface Variant {
  priceType: PriceType;
  label: string;
  pricePaise: number;
}

/** Shown instead of adding straight to the cart when an item has at least
 * one active add-on (e.g. "Extra Cream" on a Chaap, "Extra Cheese" on a
 * Roll) — lets the customer pick which ones they want before it's added. */
function AddonPickerSheet({
  itemName,
  variant,
  addons,
  onClose,
  onConfirm,
}: {
  itemName: string;
  variant: Variant;
  addons: MenuItemAddonRow[];
  onClose: () => void;
  onConfirm: (selected: MenuItemAddonRow[], quantity: number) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = addons.filter((a) => selectedIds.has(a.id));
  const unitTotal = variant.pricePaise + selected.reduce((s, a) => s + a.price_paise, 0);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      <div className="relative flex w-full max-h-[80vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 sm:max-w-md">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">{itemName}</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {variant.label} · {formatRupees(variant.pricePaise)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-stone-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Add extras</p>
          <div className="space-y-2">
            {addons.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-stone-200 px-3 py-2.5 dark:border-stone-700"
              >
                <span className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
                  <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4 accent-brand-600" />
                  {a.name}
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400">+{formatRupees(a.price_paise)}</span>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">Quantity</span>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>
        </div>

        <div className="border-t border-stone-100 px-5 py-4 dark:border-stone-800">
          <button
            onClick={() => onConfirm(selected, quantity)}
            className="w-full rounded-2xl bg-brand-600 py-3.5 font-semibold text-white active:scale-95"
          >
            Add {formatRupees(unitTotal * quantity)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ItemCard({ item }: { item: MenuItemRow }) {
  const { lines, addItem, setQuantity } = useCart();
  const isAvailable = item.status === "ACTIVE";
  const [pickingVariant, setPickingVariant] = useState<Variant | null>(null);
  const activeAddons = item.addons.filter((a) => a.active);

  const variants: Variant[] = [];
  if (item.has_half) {
    const price = item.prices.find((p) => p.price_type === "HALF");
    if (price) variants.push({ priceType: "HALF", label: item.half_label, pricePaise: price.price_paise });
  }
  if (item.has_full) {
    const price = item.prices.find((p) => p.price_type === "FULL");
    if (price) variants.push({ priceType: "FULL", label: item.full_label, pricePaise: price.price_paise });
  }
  if (item.has_single) {
    const price = item.prices.find((p) => p.price_type === "SINGLE");
    if (price) variants.push({ priceType: "SINGLE", label: item.unit_label, pricePaise: price.price_paise });
  }

  if (variants.length === 0) return null;

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-3 shadow-sm ${
        isAvailable
          ? "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800"
          : "border-stone-200 bg-stone-50 opacity-70 dark:border-stone-700 dark:bg-stone-800/50"
      }`}
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-stone-700 dark:text-brand-400">
          <UtensilsCrossed size={22} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">{item.name}</h3>
          {!isAvailable && (
            <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
              Currently unavailable
            </span>
          )}
        </div>

        <div className="mt-2 space-y-2">
          {variants.map((v) => {
            const key = `${item.id}:${v.priceType}:`;
            const line = lines.find((l) => l.key === key);
            // With add-ons, the same item+variant can exist as several cart
            // lines (one per distinct add-on combo) — show the combined
            // quantity instead of trying to pick one line's stepper.
            const addonCartQty = activeAddons.length
              ? lines.filter((l) => l.menuItemId === item.id && l.priceType === v.priceType).reduce((s, l) => s + l.quantity, 0)
              : 0;
            return (
              <div key={v.priceType} className="flex items-center justify-between">
                <div className="text-sm text-stone-500 dark:text-stone-400">
                  {v.label}{" "}
                  <span className="ml-2 font-medium text-stone-800 dark:text-stone-200">{formatRupees(v.pricePaise)}</span>
                </div>
                {!isAvailable ? null : activeAddons.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {addonCartQty > 0 && <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">× {addonCartQty} in cart</span>}
                    <button
                      type="button"
                      onClick={() => setPickingVariant(v)}
                      className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white active:scale-95"
                    >
                      Add
                    </button>
                  </div>
                ) : line ? (
                  <QuantityStepper value={line.quantity} onChange={(q) => setQuantity(key, q)} />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      addItem({ menuItemId: item.id, name: item.name, priceType: v.priceType, unitPricePaise: v.pricePaise, addons: [] }, 1)
                    }
                    className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white active:scale-95"
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pickingVariant && (
        <AddonPickerSheet
          itemName={item.name}
          variant={pickingVariant}
          addons={activeAddons}
          onClose={() => setPickingVariant(null)}
          onConfirm={(selected, quantity) => {
            addItem(
              {
                menuItemId: item.id,
                name: item.name,
                priceType: pickingVariant.priceType,
                unitPricePaise: pickingVariant.pricePaise,
                addons: selected.map((a) => ({ id: a.id, name: a.name, pricePaise: a.price_paise })),
              },
              quantity
            );
            setPickingVariant(null);
          }}
        />
      )}
    </div>
  );
}
