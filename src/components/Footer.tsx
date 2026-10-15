import { useQuery } from "@tanstack/react-query";
import { Clock, Instagram, MapPin, Navigation, Phone, ScrollText } from "lucide-react";
import { api } from "../api/client";
import { useStoreStatus } from "../hooks";
import logo from "../assets/logo.png";

interface BusinessInfo {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  instagram: string;
  mapsUrl: string;
}

/** Only plain https links are ever turned into clickable links. */
function safeHttps(url: string | null | undefined): string {
  const v = (url ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : "";
}

/** Accepts "@handle", "handle" or a full instagram.com link. */
function instagramParts(raw: string): { handle: string; url: string } | null {
  const v = raw.trim();
  if (!v) return null;
  const fromUrl = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const candidate = fromUrl ? fromUrl[1] : v.replace(/^@/, "");
  // A real username is letters, numbers, "." and "_" only (max 30). A display
  // name like "Desi Chaap Di Haati || BIT" isn't one — better to show no
  // Instagram button than a link to the wrong/nonexistent profile.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(candidate)) return null;
  return { handle: candidate, url: `https://www.instagram.com/${candidate}` };
}

const TERMS: { title: string; body: string }[] = [
  {
    title: "Delivery time is not guaranteed",
    body: "Any delivery or preparation time shown is only an estimate. The actual time depends on how many orders we have, kitchen rush, distance and traffic, and it can take longer than shown. We do not promise delivery within any specific time, but we always try our best to reach you as soon as possible.",
  },
  {
    title: "Orders are made fresh",
    body: "Every order is prepared fresh after it is accepted, so during busy hours it may take more time than usual.",
  },
  {
    title: "No cancellation or changes after acceptance",
    body: "Please check your order carefully before placing it. Once placed and accepted by the restaurant, it cannot be cancelled or modified.",
  },
  {
    title: "Ordering hours",
    body: "Orders are accepted only during our opening hours shown above, and ordering may be paused at times, for example when we are very busy or an item runs out.",
  },
];

/** Contact/location footer for the menu page. Every row is optional — it
 * only renders what the owner has filled in under Admin → Settings → Business
 * Profile, so it never shows an empty label or a dead link. */
export function Footer() {
  const { data } = useQuery({
    queryKey: ["business-info"],
    queryFn: () => api.get<BusinessInfo>("/public/business-info"),
    staleTime: 10 * 60_000,
  });
  const store = useStoreStatus();
  if (!data) return null;

  const insta = instagramParts(data.instagram);
  const phoneDigits = data.phone.replace(/[^\d+]/g, "");
  const showHours = store.loaded && store.weekSummary.length > 0;
  const mapsUrl =
    safeHttps(data.mapsUrl) ||
    (data.address.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}` : "");

  const rowClass = "flex items-start gap-3 text-sm text-stone-600 dark:text-stone-300";
  const iconClass = "mt-0.5 shrink-0 text-brand-600 dark:text-brand-400";

  return (
    <footer className="mt-6 border-t border-stone-200 bg-stone-50 px-4 pb-6 pt-8 dark:border-stone-800 dark:bg-stone-900 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
        <div>
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-bold text-stone-900 dark:text-stone-100">{data.businessName}</p>
              {data.tagline && <p className="text-xs text-stone-500 dark:text-stone-400">{data.tagline}</p>}
            </div>
          </div>
          {insta && (
            <a
              href={insta.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm active:scale-95"
            >
              <Instagram size={16} /> @{insta.handle}
            </a>
          )}
        </div>

        <div className="space-y-3">
          {data.address.trim() && (
            <div className={rowClass}>
              <MapPin size={16} className={iconClass} />
              <span className="whitespace-pre-line">{data.address.trim()}</span>
            </div>
          )}
          {data.phone.trim() && (
            <a href={`tel:${phoneDigits}`} className={rowClass}>
              <Phone size={16} className={iconClass} />
              <span className="font-medium">{data.phone.trim()}</span>
            </a>
          )}
          {showHours && (
            <div className={rowClass}>
              <Clock size={16} className={iconClass} />
              <div className="space-y-0.5">
                {store.weekSummary.map((r) => (
                  <div key={r.label} className="flex gap-3">
                    <span className="w-16 font-medium">{r.label}</span>
                    <span>{r.hours}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 active:scale-95 dark:border-stone-600 dark:text-stone-200"
            >
              <Navigation size={15} /> Get directions on Google Maps
            </a>
          )}
        </div>
      </div>

      <section className="mx-auto mt-8 max-w-5xl rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-800/60 dark:ring-stone-700">
        <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-stone-100">
          <ScrollText size={16} className="text-brand-600 dark:text-brand-400" /> Terms &amp; Conditions
        </h3>
        <ol className="mt-3 space-y-3">
          {TERMS.map((t, i) => (
            <li key={t.title} className="flex gap-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700 dark:bg-stone-700 dark:text-brand-300">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-stone-800 dark:text-stone-100">{t.title}</p>
                <p className="mt-0.5">{t.body}</p>
                {i === 0 && <p className="mt-0.5 opacity-70">Delivery ka time fix nahi hai — order aur rush ke hisaab se zyada time lag sakta hai.</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-col items-center gap-3 border-t border-stone-200 pt-5 dark:border-stone-800">
        {(insta || mapsUrl) && (
          <div className="flex items-center gap-3">
            {insta && (
              <a
                href={insta.url}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                title="Follow us on Instagram"
                className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-600 via-rose-500 to-amber-500 text-white shadow-sm transition active:scale-90"
              >
                <Instagram size={18} />
              </a>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Find us on Google Maps"
                title="Find us on Google Maps"
                className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white shadow-sm transition active:scale-90"
              >
                <MapPin size={18} />
              </a>
            )}
          </div>
        )}
        <p className="text-center text-xs text-stone-400">
          © {new Date().getFullYear()} {data.businessName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
