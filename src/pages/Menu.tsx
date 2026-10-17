import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ClipboardList, Leaf, Moon, RefreshCw, Search, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { MenuCategory, OrderRow } from "../api/types";
import { useBusinessInfo } from "../hooks";
import { InstallPrompt } from "../components/AppBanners";
import { useTheme } from "../context/ThemeContext";
import { CategoryTabs } from "../components/CategoryTabs";
import { ItemCard } from "../components/ItemCard";
import { CartBar } from "../components/CartBar";
import { CartSheet } from "../components/CartSheet";
import { MenuSkeleton } from "../components/MenuSkeleton";
import { OffersBanner } from "../components/OffersBanner";
import { BannerCarousel } from "../components/BannerCarousel";
import { StoreClosedStrip, StoreStatusBanner, StoreStatusChip } from "../components/StoreClosedBanner";
import { AccountMenu } from "../components/AccountMenu";
import { Footer } from "../components/Footer";
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
      className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-500 transition dark:bg-stone-800 dark:text-amber-400"
    >
      {isDark ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}

export function Menu() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["public-menu"],
    queryFn: () => api.get<{ categories: MenuCategory[] }>("/public/menu"),
  });
  const business = useBusinessInfo();
  // The customer's own orders: a live one gets a "track" shortcut; any past one makes them a returning customer.
  const { data: myOrders } = useQuery({
    queryKey: ["customer-orders"],
    queryFn: () => api.get<{ orders: OrderRow[] }>("/public/orders"),
    staleTime: 15_000,
  });
  const LIVE = ["PENDING_ACCEPTANCE", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];
  const liveOrder = myOrders?.orders.find((o) => LIVE.includes(o.status) && Date.now() - new Date(o.created_at).getTime() < 6 * 3_600_000);

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
    <div className="min-h-screen bg-white pb-28 dark:bg-stone-950">
      <header className="bg-white dark:bg-stone-900">
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-9 w-9 object-contain lg:h-11 lg:w-11" />
            <div>
              <p className="text-lg font-bold leading-tight lg:text-2xl text-stone-900 dark:text-stone-100">Chaap Di Haati</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <StoreStatusChip />
                {business?.pureVeg && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-800">
                    <Leaf size={11} /> Pure Veg
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate("/orders")}
              aria-label="Your orders"
              title="Your orders"
              className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
            >
              <ClipboardList size={18} />
            </button>
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>

        {liveOrder && (
          <button
            onClick={() => navigate(`/order/${liveOrder.id}`)}
            className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center justify-between gap-3 rounded-2xl bg-brand-600 px-4 py-3 text-left text-white shadow-md lg:mx-8 lg:w-[calc(100%-4rem)]"
          >
            <span className="text-sm">
              <span className="block font-semibold">Order #{liveOrder.order_number} is live</span>
              <span className="text-xs text-brand-100">Tap to track it</span>
            </span>
            <ChevronRight size={20} />
          </button>
        )}
        <InstallPrompt eligible={(myOrders?.orders.length ?? 0) > 0} />
        <BannerCarousel />
        <OffersBanner />
        <StoreStatusBanner />
        <p className="mx-4 mb-3 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-stone-800 dark:text-brand-400 lg:mx-8">
          ⏱ Preparation takes about 15 min. Delivery may take more than 30 min depending on distance and traffic.
        </p>
      </header>

      <div className="sticky top-0 z-10 bg-white/95 shadow-sm backdrop-blur dark:bg-stone-900/95">
        <StoreClosedStrip />
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
        {isError && !data && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <p className="text-stone-600 dark:text-stone-300">Couldn't load the menu. Please check your internet connection.</p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand-600 px-5 font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} /> Try again
            </button>
          </div>
        )}

        {!isLoading && query && (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {searchResults!.length === 0 ? (
              <p className="mt-8 text-center text-stone-400">No items match "{search}".</p>
            ) : (
              searchResults!.map((item) => <ItemCard key={item.id} item={item} />)
            )}
          </div>
        )}

        {!isLoading && !query && current && (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {current.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      <Footer />

      <CartBar onOpen={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
