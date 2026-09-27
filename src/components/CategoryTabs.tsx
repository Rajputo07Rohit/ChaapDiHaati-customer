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
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
            active === cat.id ? "bg-brand-600 text-white" : "bg-white text-stone-600 border border-stone-200"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
