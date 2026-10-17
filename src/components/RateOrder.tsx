import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Star } from "lucide-react";
import { api, ApiError } from "../api/client";

/**
 * A private rating that goes straight to the owner (not Google), so a bad
 * experience reaches the restaurant and can be put right. Kept separate from
 * the "Rate us on Google" prompt, which is offered to everyone alike.
 */
export function RateOrder({ orderId, existing }: { orderId: string; existing: { rating: number; comment: string | null } | null }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ rating: number } | null>(existing);

  async function submit() {
    if (!rating) return;
    setSaving(true);
    try {
      await api.post(`/public/orders/${orderId}/feedback`, { rating, comment: comment.trim() || undefined });
      setDone({ rating });
      queryClient.invalidateQueries({ queryKey: ["order-status", orderId] });
      queryClient.invalidateQueries({ queryKey: ["customer-order-detail", orderId] });
      toast.success("Thanks for your feedback!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send your rating. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5 w-full max-w-xs rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:bg-stone-900 dark:text-stone-300 lg:max-w-md">
        <div className="flex justify-center gap-0.5" aria-label={`You rated ${done.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} size={18} className={n <= done.rating ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
          ))}
        </div>
        <p className="mt-1">Thanks for rating your order!</p>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full max-w-xs rounded-2xl bg-stone-50 p-4 dark:bg-stone-900 lg:max-w-md">
      <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">How was your order?</p>
      <p className="text-xs text-stone-500 dark:text-stone-400">Only the restaurant sees this.</p>
      <div className="mt-2 flex justify-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="p-1.5 transition active:scale-90"
          >
            <Star size={30} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-stone-300 dark:text-stone-600"} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={rating <= 3 ? "What went wrong? We'll fix it." : "Anything you loved? (optional)"}
            className="mt-2 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
          />
          <button onClick={submit} disabled={saving} className="mt-2 min-h-[44px] w-full rounded-xl bg-brand-600 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Sending…" : "Send rating"}
          </button>
        </>
      )}
    </div>
  );
}
