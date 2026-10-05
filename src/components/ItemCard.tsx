import { UtensilsCrossed } from "lucide-react";
import { MenuItemRow, PriceType } from "../api/types";
import { useCart } from "../context/CartContext";
import { QuantityStepper } from "./QuantityStepper";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function ItemCard({ item }: { item: MenuItemRow }) {
  const { lines, addItem, setQuantity } = useCart();
  const isAvailable = item.status === "ACTIVE";

  const variants: { priceType: PriceType; label: string; pricePaise: number }[] = [];
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
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-stone-700 dark:text-brand-400">
        <UtensilsCrossed size={22} />
      </div>

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
            const key = `${item.id}:${v.priceType}`;
            const line = lines.find((l) => l.key === key);
            return (
              <div key={v.priceType} className="flex items-center justify-between">
                <div className="text-sm text-stone-500 dark:text-stone-400">
                  {v.label}{" "}
                  <span className="ml-2 font-medium text-stone-800 dark:text-stone-200">{formatRupees(v.pricePaise)}</span>
                </div>
                {!isAvailable ? null : line ? (
                  <QuantityStepper value={line.quantity} onChange={(q) => setQuantity(key, q)} />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      addItem({ menuItemId: item.id, name: item.name, priceType: v.priceType, unitPricePaise: v.pricePaise }, 1)
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
    </div>
  );
}
