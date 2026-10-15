import { Clock3 } from "lucide-react";

/** One honest message about delivery time, reused on the menu, cart,
 * review step and confirm popup so the customer is never told "30 min" in
 * one place and "it may take longer" in another. */
export function DeliveryTimeNotice({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:ring-amber-800/60 ${className}`}
    >
      <Clock3 size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="text-xs leading-relaxed">
        <p className="font-semibold">Delivery may take more than 30 minutes</p>
        {!compact && (
          <p className="mt-0.5 opacity-90">
            We can't promise a 30-minute delivery. Time depends on kitchen rush, distance and traffic — we'll do our best to reach you as soon
            as possible. Thank you for your patience! 🙏
          </p>
        )}
        <p className="mt-0.5 opacity-70">Delivery mein 30 min se zyada time lag sakta hai.</p>
      </div>
    </div>
  );
}
