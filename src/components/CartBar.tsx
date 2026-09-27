import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function CartBar() {
  const { itemCount, totalPaise } = useCart();
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-3">
      <button
        type="button"
        onClick={() => navigate("/cart")}
        className="flex w-full items-center justify-between rounded-2xl bg-brand-600 px-5 py-3.5 text-white shadow-lg active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 font-semibold">
          <ShoppingBag size={18} />
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          {formatRupees(totalPaise)} <span className="ml-1 text-sm font-normal opacity-90">View cart →</span>
        </span>
      </button>
    </div>
  );
}
