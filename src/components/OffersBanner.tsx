import { useQuery } from "@tanstack/react-query";
import { Tag } from "lucide-react";
import { api } from "../api/client";
import { PromoCodeOffer } from "../api/types";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(paise % 100 === 0 ? 0 : 2)}`;
}

function offerHeadline(o: PromoCodeOffer): string {
  return o.discount_type === "PERCENTAGE" ? `${o.discount_value}% OFF` : `${formatRupees(o.discount_value)} OFF`;
}

/** A Zomato-style horizontal strip of active offers on the menu screen —
 * purely informational here; the code is actually redeemed (and
 * re-validated server-side) at checkout. */
export function OffersBanner() {
  const { data } = useQuery({
    queryKey: ["active-promo-codes"],
    queryFn: () => api.get<{ codes: PromoCodeOffer[] }>("/public/promo-codes/active"),
  });

  const offers = data?.codes ?? [];
  if (offers.length === 0) return null;

  return (
    <div className="flex gap-2.5 overflow-x-auto px-4 pb-3 lg:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {offers.map((o) => (
        <div
          key={o.code}
          className="flex shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2.5 text-white shadow-sm"
        >
          <Tag size={16} className="shrink-0" />
          <div>
            <p className="text-sm font-bold leading-tight">{offerHeadline(o)}</p>
            <p className="text-[11px] leading-tight text-white/90">
              Use <span className="font-semibold">{o.code}</span>
              {o.min_order_paise > 0 ? ` · min ${formatRupees(o.min_order_paise)}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
