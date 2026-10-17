import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-brand-50 px-1 py-0.5 dark:bg-stone-700">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand-600 shadow-sm active:scale-95 dark:bg-stone-900 dark:text-brand-400"
        aria-label="Decrease quantity"
      >
        <Minus size={16} />
      </button>
      <span className="w-5 text-center font-semibold text-stone-800 dark:text-stone-100">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white shadow-sm active:scale-95"
        aria-label="Increase quantity"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
