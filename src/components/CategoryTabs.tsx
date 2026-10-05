export function CategoryTabs({
  categories,
  active,
  onSelect,
}: {
  categories: { id: string; name: string }[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-3 pt-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            active === cat.id
              ? "bg-brand-600 text-white"
              : "border border-stone-200 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
