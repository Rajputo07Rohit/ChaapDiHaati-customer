import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useStoreStatus } from "../hooks";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function CartBar({ onOpen }: { onOpen: () => void }) {
  const { itemCount, totalPaise } = useCart();
  const { isOpen } = useStoreStatus();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center p-3">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full max-w-md lg:max-w-xl items-center justify-between rounded-2xl px-5 py-3.5 text-white shadow-lg active:scale-[0.99] ${isOpen ? "bg-brand-600" : "bg-stone-700"}`}
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingBag size={18} />
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          {formatRupees(totalPaise)} <span className="ml-1 text-sm font-normal opacity-90">{isOpen ? "View cart →" : "Store closed"}</span>
        </span>
      </button>
    </div>
  );
}
