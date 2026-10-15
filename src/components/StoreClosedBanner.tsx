import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock3, Hourglass, Moon } from "lucide-react";
import { formatClock, formatClockDuration, formatDuration, useStoreStatus } from "../hooks";

const CLOSING_SOON_SECONDS = 30 * 60;

/** Ticks once a second on its own, so only this small piece re-renders. When it
 * hits zero it asks the server again, which flips the page to "Open now". */
function LiveCountdown({ changesAt }: { changesAt: number }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((changesAt - now) / 1000));
  useEffect(() => {
    if (left === 0) queryClient.invalidateQueries({ queryKey: ["store-status"] });
  }, [left, queryClient]);
  return <span className="tabular-nums">{formatClockDuration(left)}</span>;
}

/** Compact live status under the brand name — the first thing seen on load. */
export function StoreStatusChip() {
  const s = useStoreStatus();
  if (!s.loaded) return <div className="mt-1 h-4 w-32 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />;

  const soon = s.isOpen && s.secondsLeft != null && s.secondsLeft <= CLOSING_SOON_SECONDS;
  const detail = s.isOpen
    ? soon
      ? `closes in ${formatDuration(s.secondsLeft!)}`
      : !s.manual && s.nextChangeTime
        ? `until ${formatClock(s.nextChangeTime)}`
        : null
    : !s.manual && s.nextChangeTime
      ? `opens ${formatClock(s.nextChangeTime)}`
      : null;

  const tone = !s.isOpen ? "text-rose-600 dark:text-rose-400" : soon ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
  const dot = !s.isOpen ? "bg-rose-500" : soon ? "bg-amber-500" : "bg-emerald-500";

  return (
    <p role="status" className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <span className="relative flex h-2 w-2">
        {s.isOpen && <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {s.isOpen ? "Open now" : "Closed"}
      {detail && <span className="font-medium text-stone-500 dark:text-stone-400">· {detail}</span>}
    </p>
  );
}

/** Full-width card in the page header: a hero when closed, a gentle warning when closing soon, nothing when simply open (the chip covers that). */
export function StoreStatusBanner() {
  const s = useStoreStatus();
  if (!s.loaded) return null;

  if (s.isOpen) {
    if (s.secondsLeft == null || s.secondsLeft > CLOSING_SOON_SECONDS) return null;
    return (
      <div
        role="status"
        className="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800/60 lg:mx-8"
      >
        <Hourglass size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-900 dark:text-amber-200">
          <span className="font-bold">Closing in {formatDuration(s.secondsLeft)}.</span> Place your order soon!
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mb-3 overflow-hidden rounded-3xl bg-gradient-to-br from-stone-800 to-stone-900 text-white shadow-lg ring-1 ring-black/10 dark:from-stone-800 dark:to-stone-950 lg:mx-8"
    >
      <div className="flex items-start gap-4 p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-amber-300">
          <Moon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">We're not taking orders right now</h2>
          <p className="mt-1 text-sm text-stone-300">{s.message}</p>
          {!s.manual && s.changesAt != null && (
            <div className="mt-3 inline-flex items-center gap-2.5 rounded-2xl bg-brand-500 px-4 py-2 text-white shadow-lg shadow-brand-600/30">
              <Clock3 size={18} />
              <div className="leading-tight">
                <p className="text-[11px] font-medium uppercase tracking-wide opacity-90">
                  Opens {s.nextChangeTime ? `at ${formatClock(s.nextChangeTime)}` : "soon"} · in
                </p>
                <p className="text-xl font-extrabold">
                  <LiveCountdown changesAt={s.changesAt} />
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-white/10 bg-black/20 px-5 py-2.5 text-xs text-stone-400">
        You can still browse the menu and build your cart — ordering unlocks when we open.
      </p>
    </div>
  );
}

/** Slim bar pinned under the header while scrolling, so "closed" is never out of sight. */
export function StoreClosedStrip() {
  const s = useStoreStatus();
  if (!s.loaded || s.isOpen) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white">
      <Moon size={12} />
      Ordering paused
      {!s.manual && s.secondsLeft != null && <span className="font-normal opacity-90">· opens in {formatDuration(s.secondsLeft)}</span>}
    </div>
  );
}
