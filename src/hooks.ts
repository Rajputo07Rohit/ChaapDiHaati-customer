import { useQuery } from "@tanstack/react-query";
import { api } from "./api/client";

export interface StoreStatus {
  isOpen: boolean;
  message: string | null;
  opensAt: string | null;
  openTime: string;
  closeTime: string;
}

/** Polled so a customer sitting on the menu sees the store close/reopen without refreshing. While loading (or if the call fails) we assume open — the server enforces closure on order placement anyway. */
export function useStoreStatus(): StoreStatus & { loaded: boolean } {
  const { data } = useQuery({
    queryKey: ["store-status"],
    queryFn: () => api.get<StoreStatus>("/public/store-status"),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  return { isOpen: data?.isOpen ?? true, message: data?.message ?? null, opensAt: data?.opensAt ?? null, openTime: data?.openTime ?? "", closeTime: data?.closeTime ?? "", loaded: !!data };
}

/** Mirrors the server rule: rumali roti needs a Tandoori (soya/paneer/mushroom) or Momo item in the cart. Extras, beverages and rolls don't unlock it. */
export function rumaliNeedsMain(lines: { menuItemId: string; name: string }[], categoryOf: Map<string, string>): boolean {
  const isRumali = (l: { name: string }) => /rumali/i.test(l.name);
  if (!lines.some(isRumali)) return false;
  return !lines.some((l) => !isRumali(l) && /tandoori|momo/i.test(categoryOf.get(l.menuItemId) ?? ""));
}
