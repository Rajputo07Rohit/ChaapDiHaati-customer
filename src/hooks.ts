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
}

export interface StoreStatus {
  loaded: boolean;
  isOpen: boolean;
  message: string | null;
  openTime: string;
  closeTime: string;
  /** True when staff paused ordering by hand (no schedule countdown applies). */
  manual: boolean;
  /** Live seconds until the schedule flips; null if there's no schedule to count down to. */
  secondsLeft: number | null;
}

/** Polled so a customer sitting on the menu sees the store close/reopen without refreshing. While loading (or if the call fails) we assume open — the server enforces closure on order placement anyway. */
export function useStoreStatus(): StoreStatus {
  const { data, dataUpdatedAt } = useQuery({
    queryKey: ["store-status"],
    queryFn: () => api.get<StoreStatusResponse>("/public/store-status"),
    refetchInterval: 60_000,
    staleTime: 15_000,
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
    manual: data ? data.mode !== "AUTO" : false,
    secondsLeft,
  };
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
