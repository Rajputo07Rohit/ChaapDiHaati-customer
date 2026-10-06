import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { OrderRow } from "../api/types";
import logo from "../assets/logo.png";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = (useLocation().state as { order?: OrderRow })?.order;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-stone-950">
      <img src={logo} alt="" className="mb-2 h-12 w-12 object-contain" />
      <CheckCircle2 size={56} className="text-brand-600" />
      <h1 className="mt-4 text-2xl font-bold text-stone-900 dark:text-stone-100">Order placed!</h1>
      {order ? (
        <>
          <p className="mt-1 text-stone-500 dark:text-stone-400">Order #{order.order_number}</p>
          <p className="mt-4 text-3xl font-bold text-stone-900 dark:text-stone-100">{formatRupees(order.net_total_paise)}</p>
          {order.discount_paise > 0 && (
            <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              You saved {formatRupees(order.discount_paise)} with your coupon
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-stone-500 dark:text-stone-400">Order #{id}</p>
      )}
      <p className="mt-6 max-w-xs rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700 dark:bg-stone-800 dark:text-brand-400">
        Your order has been sent to the kitchen. Please pay at the counter.
      </p>
      <button
        onClick={() => navigate("/menu")}
        className="mt-8 rounded-full bg-brand-600 px-8 py-3 font-semibold text-white"
      >
        Order more
      </button>
    </div>
  );
}
