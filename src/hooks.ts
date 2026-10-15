import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";

interface StoreStatusResponse {
  isOpen: boolean;
  message: string | null;
  opensAt: string | null;
  openTime: string;
  closeTime: string;
  mode: "AUTO" | "OPEN" | "CLOSED";
  changesInSeconds: number | null;
  nextChangeTime: string | null;
  weekSummary: { label: string; hours: string }[];
}

export interface StoreStatus {
  loaded: boolean;
  isOpen: boolean;
  message: string | null;
  openTime: string;
  closeTime: string;
  /** "HH:MM" of the next open (while closed) or next close (while open) — null if none applies. */
  nextChangeTime: string | null;
  /** Weekly hours grouped for display, e.g. Mon–Fri 3 PM – 10:30 PM. */
  weekSummary: { label: string; hours: string }[];
  /** True when staff paused ordering by hand (no schedule countdown applies). */
  manual: boolean;
  /** Live seconds until the schedule flips; null if there's no schedule to count down to. */
  secondsLeft: number | null;
  /** Epoch ms of the next schedule flip — lets a component run its own 1-second countdown without every consumer re-rendering each second. */
  changesAt: number | null;
}

/** Mount once near the app root: re-checks the store status every few seconds
 * (paused while the tab is hidden) so an admin opening/closing the store shows
 * up on customers' screens on its own. It lives in one place because every
 * component that reads the status shares the same cached query — giving each
 * one its own interval would multiply the requests. */
export function useStoreStatusPolling() {
  useQuery({
    queryKey: ["store-status"],
    queryFn: () => api.get<StoreStatusResponse>("/public/store-status"),
    refetchInterval: 5_000,
    staleTime: 2_000,
    refetchOnWindowFocus: true,
  });
}

/** Read the shared store status (kept fresh by useStoreStatusPolling). A customer sitting on the menu sees the store close/reopen without refreshing. While loading (or if the call fails) we assume open — the server enforces closure on order placement anyway. */
export function useStoreStatus(): StoreStatus {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["store-status"],
    queryFn: () => api.get<StoreStatusResponse>("/public/store-status"),
    staleTime: 2_000,
    refetchOnWindowFocus: true,
  });

  // Tick so the countdown stays live between polls.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft =
    data?.changesInSeconds != null ? Math.max(0, data.changesInSeconds - Math.floor((now - dataUpdatedAt) / 1000)) : null;

  return {
    loaded: !!data,
    isOpen: data?.isOpen ?? true,
    message: data?.message ?? null,
    openTime: data?.openTime ?? "",
    closeTime: data?.closeTime ?? "",
    nextChangeTime: data?.nextChangeTime ?? null,
    weekSummary: data?.weekSummary ?? [],
    manual: data ? data.mode !== "AUTO" : false,
    secondsLeft,
    changesAt: data?.changesInSeconds != null ? dataUpdatedAt + data.changesInSeconds * 1000 : null,
  };
}

/** "02:14:09" (or "1d 02:14:09" past 24h) — a ticking clock for the closed-store countdown. */
export function formatClockDuration(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(t / 86400);
  const h = Math.floor((t % 86400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** "2h 14m", "45 min", "< 1 min" */
export function formatDuration(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** Mirrors the server rule: rumali roti needs a Tandoori (soya/paneer/mushroom) or Momo item in the cart. Extras, beverages and rolls don't unlock it. */
export function rumaliNeedsMain(lines: { menuItemId: string; name: string }[], categoryOf: Map<string, string>): boolean {
  const isRumali = (l: { name: string }) => /rumali/i.test(l.name);
  if (!lines.some(isRumali)) return false;
  return !lines.some((l) => !isRumali(l) && /tandoori|momo/i.test(categoryOf.get(l.menuItemId) ?? ""));
}
