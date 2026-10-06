import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

interface Banner {
  id: string;
  image_url: string;
  title: string | null;
  link_url: string | null;
}

const AUTOPLAY_MS = 4500;

/** A premium, auto-rotating image carousel (event/festival banners,
 * admin-uploaded) at the top of the menu screen — swipeable, with a
 * progress-style dot indicator. Slides via CSS transform (not scrollTo) for
 * a smoother, more reliable glide across browsers. */
export function BannerCarousel() {
  const { data } = useQuery({
    queryKey: ["active-banners"],
    queryFn: () => api.get<{ banners: Banner[] }>("/public/banners/active"),
  });
  const banners = data?.banners ?? [];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setPaused(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }

  function handleTouchEnd() {
    if (Math.abs(touchDeltaX.current) > 40) {
      setIndex((i) => {
        const next = touchDeltaX.current < 0 ? i + 1 : i - 1;
        return (next + banners.length) % banners.length;
      });
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
    setPaused(false);
  }

  return (
    <div className="px-4 pb-4">
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-3xl shadow-lg shadow-stone-300/40 ring-1 ring-black/5 dark:shadow-black/40 dark:ring-white/10"
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => (
            <a
              key={b.id}
              href={b.link_url ?? undefined}
              target={b.link_url ? "_blank" : undefined}
              rel={b.link_url ? "noreferrer" : undefined}
              className="relative block w-full shrink-0"
            >
              <img
                src={b.image_url}
                alt={b.title ?? ""}
                className="h-48 w-full object-cover sm:h-60"
                loading="lazy"
              />
              {b.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-4 pt-10">
                  <p className="text-base font-bold leading-snug text-white drop-shadow-sm sm:text-lg">{b.title}</p>
                </div>
              )}
            </a>
          ))}
        </div>

        {banners.length > 1 && (
          <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${
                  i === index ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
