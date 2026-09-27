import { MenuItemRow, PriceType } from "../api/types";
import { useCart } from "../context/CartContext";
import { QuantityStepper } from "./QuantityStepper";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function ItemCard({ item }: { item: MenuItemRow }) {
  const { lines, addItem, setQuantity } = useCart();

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
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-stone-900">{item.name}</h3>
      <div className="mt-3 space-y-2">
        {variants.map((v) => {
          const key = `${item.id}:${v.priceType}`;
          const line = lines.find((l) => l.key === key);
          return (
            <div key={v.priceType} className="flex items-center justify-between">
              <div className="text-sm text-stone-500">
                {v.label} <span className="ml-2 font-medium text-stone-800">{formatRupees(v.pricePaise)}</span>
              </div>
              {line ? (
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
  );
}
