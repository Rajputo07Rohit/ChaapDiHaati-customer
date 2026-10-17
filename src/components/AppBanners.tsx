import { useEffect, useState } from "react";
import { Download, Share, WifiOff, X } from "lucide-react";
import { useOnline } from "../hooks";
import { isStandalone } from "../utils/push";

/** Pinned to the top while the phone has no internet, so a failed tap makes sense. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="sticky top-0 z-[70] flex items-center justify-center gap-2 bg-stone-900 px-4 py-2 text-center text-sm font-medium text-white">
      <WifiOff size={16} className="shrink-0" /> You're offline — we'll reconnect as soon as your internet is back.
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cdh_install_dismissed_at";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * "Add to Home Screen" nudge: one tap on Android/desktop Chrome (the browser's
 * own install prompt); on iPhone, a short how-to since Safari has no prompt.
 * Shown to returning customers only (after their first order), and at most
 * once every two weeks if dismissed.
 */
export function InstallPrompt({ eligible }: { eligible: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(recentlyDismissed);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!eligible || hidden || isStandalone() || (!deferred && !ios)) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // shows again next visit
    }
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-white shadow-lg dark:bg-stone-800 lg:mx-8">
      <Download size={20} className="mt-0.5 shrink-0 text-brand-400" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Get the app — order in 2 taps</p>
        {deferred ? (
          <button onClick={install} className="mt-2 min-h-[40px] rounded-full bg-brand-600 px-4 text-sm font-semibold">
            Add to Home Screen
          </button>
        ) : (
          <p className="mt-0.5 text-xs text-stone-300">
            Tap <Share size={12} className="inline align-[-2px]" /> Share, then “Add to Home Screen”. You'll also get order updates as notifications.
          </p>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="-m-2 p-2 text-stone-400">
        <X size={18} />
      </button>
    </div>
  );
}
