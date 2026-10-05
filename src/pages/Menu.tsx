import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Moon, Search, Sun, SunMoon } from "lucide-react";
import { api } from "../api/client";
import { MenuCategory } from "../api/types";
import { useTheme } from "../context/ThemeContext";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemCard } from "../components/ItemCard";
import { CartBar } from "../components/CartBar";
import { CartSheet } from "../components/CartSheet";
import { MenuSkeleton } from "../components/MenuSkeleton";
import logo from "../assets/logo.png";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "system" as const, icon: SunMoon, label: "System" },
    { value: "light" as const, icon: Sun, label: "Light" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
  ];
  return (
    <div className="flex rounded-full bg-stone-100 p-0.5 dark:bg-stone-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          aria-label={opt.label}
          title={opt.label}
          className={`grid h-7 w-7 place-items-center rounded-full transition ${
            theme === opt.value ? "bg-white text-brand-600 shadow-sm dark:bg-stone-700 dark:text-brand-400" : "text-stone-400"
          }`}
        >
          <opt.icon size={14} />
        </button>
      ))}
    </div>
  );
}

export function Menu() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });

  const categories = (data?.categories ?? []).filter((c) => c.items.length > 0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) setActiveCategory(categories[0].id);
  }, [categories, activeCategory]);

  const query = search.trim().toLowerCase();
  const searchResults = query
    ? categories.flatMap((c) => c.items).filter((item) => item.name.toLowerCase().includes(query))
    : null;
  const current = categories.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-stone-50 pb-28 dark:bg-stone-950">
      <header className="sticky top-0 z-10 bg-white/95 shadow-sm backdrop-blur dark:bg-stone-900/95">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">Chaap Di Haati</p>
          </div>
          <ThemeToggle />
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 dark:bg-stone-800">
            <Search size={16} className="text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search food"
              className="w-full bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none dark:text-stone-100"
            />
          </div>
        </div>

        {!query && categories.length > 0 && (
          <CategoryTabs categories={categories} active={activeCategory} onSelect={setActiveCategory} />
        )}
      </header>

      <main className="px-4 py-4">
        {isLoading && <MenuSkeleton />}
        {isError && <p className="mt-8 text-center text-red-500">Couldn't load the menu. Please try again.</p>}

        {!isLoading && query && (
          <div className="space-y-3">
            {searchResults!.length === 0 ? (
              <p className="mt-8 text-center text-stone-400">No items match "{search}".</p>
            ) : (
              searchResults!.map((item) => <ItemCard key={item.id} item={item} />)
            )}
          </div>
        )}

        {!isLoading && !query && current && (
          <div className="space-y-3">
            {current.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <CartBar onOpen={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
