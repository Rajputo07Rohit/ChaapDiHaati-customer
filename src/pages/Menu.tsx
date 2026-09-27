import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { MenuCategory } from "../api/types";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemCard } from "../components/ItemCard";
import { CartBar } from "../components/CartBar";

export function Menu() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });

  const categories = (data?.categories ?? []).filter((c) => c.items.length > 0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories, activeCategory]);

  const current = categories.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-bold text-stone-900">Chaap Di Haati</p>
          </div>
        </div>
        {categories.length > 0 && (
          <CategoryTabs categories={categories} active={activeCategory} onSelect={setActiveCategory} />
        )}
      </header>

      <main className="px-4 py-4">
        {isLoading && <p className="mt-8 text-center text-stone-400">Loading menu…</p>}
        {isError && <p className="mt-8 text-center text-red-500">Couldn't load the menu. Please try again.</p>}
        {current && (
          <div className="space-y-3">
            {current.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <CartBar />
    </div>
  );
}
