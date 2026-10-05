export function MenuSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-stone-200 dark:bg-stone-700" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
          </div>
        </div>
      ))}
    </div>
  );
}
