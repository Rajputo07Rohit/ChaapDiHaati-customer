import { Clock3, Moon } from "lucide-react";
import { useStoreStatus } from "../hooks";

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Open: a small green "Open now" pill with today's hours. Closed: a prominent card explaining why and when we're back. */
export function StoreStatusBanner() {
  const s = useStoreStatus();
  if (!s.loaded) return null;
  const allDay = s.openTime === s.closeTime;

  if (s.isOpen) {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 lg:mx-8">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold">Open now · taking orders</span>
        {!allDay && s.closeTime && <span className="text-emerald-600/80 dark:text-emerald-400/70">· till {fmt12(s.closeTime)}</span>}
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-900/20 lg:mx-8">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
        <Moon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-rose-800 dark:text-rose-200">We're closed right now</p>
        <p className="mt-0.5 text-sm text-rose-700 dark:text-rose-300">{s.message}</p>
        {s.opensAt && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-stone-900/50 dark:text-rose-300">
            <Clock3 size={12} /> Opens at {fmt12(s.opensAt)}
          </p>
        )}
        <p className="mt-2 text-xs text-rose-600/80 dark:text-rose-300/70">You can still browse the menu.</p>
      </div>
    </div>
  );
}
