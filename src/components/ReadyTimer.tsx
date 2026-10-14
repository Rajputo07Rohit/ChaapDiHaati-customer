import { useEffect, useState } from "react";
import { ChefHat, Timer } from "lucide-react";
import { OrderRow } from "../api/types";

const COOKING_STATUSES = ["CONFIRMED", "PREPARING", "READY"];

function clock(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** The restaurant picks a prep time per order when accepting it. Shown as a
 * live countdown with the actual ready-by clock time, so "25 min" doesn't
 * go stale the moment the customer stops looking at it. */
export function ReadyTimer({ order }: { order: Pick<OrderRow, "status" | "prep_time_minutes" | "confirmed_at" | "order_type"> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  if (!COOKING_STATUSES.includes(order.status) || !order.prep_time_minutes) return null;

  const start = order.confirmed_at ? new Date(order.confirmed_at).getTime() : now;
  const readyAt = new Date(start + order.prep_time_minutes * 60_000);
  const minsLeft = Math.ceil((readyAt.getTime() - now) / 60_000);
  const late = minsLeft <= 0;

  return (
    <div className="mt-4 w-full max-w-xs rounded-2xl bg-brand-50 px-4 py-3 text-left ring-1 ring-brand-200 dark:bg-stone-800 dark:ring-stone-700">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
          {late ? <ChefHat size={20} /> : <Timer size={20} />}
        </div>
        <div>
          <p className="text-lg font-extrabold leading-tight text-stone-900 dark:text-stone-100">
            {late ? "Almost ready…" : `Ready in ${minsLeft} min`}
          </p>
          <p className="text-xs text-stone-600 dark:text-stone-400">
            {late ? "Your food is being finished up." : `Around ${clock(readyAt)}`}
            {order.order_type === "DELIVERY" && !late && " · then ~15 min delivery"}
          </p>
        </div>
      </div>
    </div>
  );
}
