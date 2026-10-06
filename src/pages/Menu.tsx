import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Moon, Receipt, Search, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { MenuCategory } from "../api/types";
import { useTheme } from "../context/ThemeContext";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemCard } from "../components/ItemCard";
import { CartBar } from "../components/CartBar";
import { CartSheet } from "../components/CartSheet";
import { MenuSkeleton } from "../components/MenuSkeleton";
import { OffersBanner } from "../components/OffersBanner";
import { BannerCarousel } from "../components/BannerCarousel";
import logo from "../assets/logo.png";

/** A single, unambiguous light/dark switch — the previous 3-way
 * System/Light/Dark segmented control put two moon-ish icons side by side
 * (the "System" icon reads as a dim moon too), which read as two dark-mode
 * buttons. One toggle, one icon, no ambiguity. */
function ThemeToggle() {
  const { isDark, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500 transition dark:bg-stone-800 dark:text-amber-400"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

export function Menu() {
  const navigate = useNavigate();
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
      <header className="bg-white dark:bg-stone-900">
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain" />
            <p className="text-lg font-bold text-stone-900 dark:text-stone-100">Chaap Di Haati</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/orders")}
              aria-label="Your orders"
              title="Your orders"
              className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
            >
              <Receipt size={16} />
            </button>
            <ThemeToggle />
          </div>
        </div>

        <BannerCarousel />
        <OffersBanner />
      </header>

      <div className="sticky top-0 z-10 bg-white/95 shadow-sm backdrop-blur dark:bg-stone-900/95">
        <div className="px-4 py-3 lg:px-8">
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
      </div>

      <main className="px-4 py-4 lg:px-8 lg:py-6">
        {isLoading && <MenuSkeleton />}
        {isError && <p className="mt-8 text-center text-red-500">Couldn't load the menu. Please try again.</p>}

        {!isLoading && query && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            {searchResults!.length === 0 ? (
              <p className="mt-8 text-center text-stone-400">No items match "{search}".</p>
            ) : (
              searchResults!.map((item) => <ItemCard key={item.id} item={item} />)
            )}
          </div>
        )}

        {!isLoading && !query && current && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
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
