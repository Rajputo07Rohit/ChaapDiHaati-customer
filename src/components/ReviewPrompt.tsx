import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { api } from "../api/client";

interface BusinessInfo {
  businessName: string;
  reviewUrl: string;
}

const STORAGE_PREFIX = "cdh_review_prompted_";

/** Has this order's review popup already been shown (and so shouldn't pop again)? */
export function wasReviewPrompted(orderId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + orderId) === "1";
  } catch {
    return false;
  }
}

export function markReviewPrompted(orderId: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + orderId, "1");
  } catch {
    // Worst case the popup shows again next visit.
  }
}

/** Link to the shop's Google review page, or null if none is configured. */
export function useReviewUrl(): string | null {
  const { data } = useQuery({
    queryKey: ["business-info"],
    queryFn: () => api.get<BusinessInfo>("/public/business-info"),
    staleTime: 10 * 60_000,
  });
  const url = data?.reviewUrl?.trim() ?? "";
  // Only plain https links are opened.
  return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

/**
 * "Rate us on Google" popup shown once the order is delivered. Every star —
 * and the main button — opens the same Google review page: Google doesn't
 * allow routing only happy customers there, so the popup doesn't try to.
 */
export function ReviewPrompt({ delivered, onClose }: { delivered: boolean; onClose: () => void }) {
  const reviewUrl = useReviewUrl();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!reviewUrl) return null;

  function openReview() {
    window.open(reviewUrl!, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Rate us on Google">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
      <div className="cdh-rise relative w-full max-w-sm rounded-t-3xl bg-white p-6 text-center shadow-2xl dark:bg-stone-900 sm:rounded-3xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-stone-400">
          <X size={20} />
        </button>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-3xl dark:bg-amber-900/30">{delivered ? "🛵" : "😋"}</div>
        <h2 className="mt-3 text-xl font-bold text-stone-900 dark:text-stone-100">
          {delivered ? "Your order has been delivered!" : "Hope you enjoyed your meal!"}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          How was your experience? A quick rating on Google helps us a lot.
        </p>

        <div className="mt-4 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={openReview} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="p-1 transition active:scale-90">
              <Star size={34} className="fill-amber-400 text-amber-400" />
            </button>
          ))}
        </div>

        <button
          onClick={openReview}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/30 active:scale-[0.98]"
        >
          Rate us on Google
        </button>
        <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-stone-400">
          Maybe later
        </button>
      </div>
    </div>
  );
}
