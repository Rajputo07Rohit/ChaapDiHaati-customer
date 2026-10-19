import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Bell, BellOff, ClipboardList, LogOut, MessageCircle, User } from "lucide-react";
import { api } from "../api/client";
import { CustomerProfile } from "../api/types";
import { disablePush, enablePush, getPushState, PushState } from "../utils/push";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { forgetPhone } from "../utils/session";
import { useCart } from "../context/CartContext";

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

/** Account button in the menu header: shows which number is signed in, a
 * shortcut to past orders, and Log out. */
export function AccountMenu() {
  const { phone, signOut } = useCustomerAuth();
  const { clear } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: () => api.get<CustomerProfile>("/public/profile"),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) getPushState().then(setPush).catch(() => setPush("unsupported"));
  }, [open]);

  async function togglePush() {
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
        toast("Order notifications turned off.");
      } else {
        const next = await enablePush();
        if (next === "unsupported") {
          // Keep the row visible (as Off) and say why, instead of it silently vanishing.
          setPush("off");
          toast.error("Order notifications aren't available right now.");
          return;
        }
        setPush(next);
        if (next === "on") toast.success("You'll get order updates as notifications.");
        else if (next === "denied") toast.error("Notifications are blocked — allow them for this site in your browser settings.");
        else if (next === "needs-install") toast("On iPhone, first add this app to your Home Screen (Share → Add to Home Screen).");
      }
    } catch {
      toast.error("Couldn't change notifications. Please try again.");
    }
  }

  async function toggleWhatsapp() {
    const optIn = !(profile?.whatsapp_opt_in ?? true);
    try {
      await api.post("/public/profile/whatsapp", { optIn });
      queryClient.invalidateQueries({ queryKey: ["customer-profile"] });
      toast.success(optIn ? "WhatsApp order updates on." : "WhatsApp order updates off.");
    } catch {
      toast.error("Couldn't save that. Please try again.");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    // This device shouldn't keep getting the previous person's order updates.
    await disablePush().catch(() => undefined);
    // The cart belongs to whoever was signed in — don't hand it to the next person on this device.
    clear();
    try {
      sessionStorage.clear();
    } catch {
      // Nothing to clear if storage isn't available.
    }
    forgetPhone();
    signOut();
    navigate("/verify", { replace: true });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        aria-label="Account"
        aria-expanded={open}
        title="Account"
        className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
      >
        <User size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-stone-900 dark:ring-white/10">
          <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <p className="text-xs text-stone-400">Signed in as</p>
            <p className="font-semibold text-stone-900 dark:text-stone-100">{phone ? formatPhone(phone) : "—"}</p>
          </div>
          <button
            onClick={() => navigate("/orders")}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-800"
          >
            <ClipboardList size={16} /> Your orders
          </button>
          {push && push !== "unsupported" && (
            <button
              onClick={togglePush}
              className="flex w-full items-center gap-2.5 border-t border-stone-100 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              {push === "on" ? <Bell size={16} className="text-emerald-600" /> : <BellOff size={16} />}
              <span className="flex-1 text-left">Order notifications</span>
              <span className={`text-xs font-semibold ${push === "on" ? "text-emerald-600" : "text-stone-400"}`}>{push === "on" ? "On" : "Off"}</span>
            </button>
          )}
          {profile?.whatsapp_available && (
            <button
              onClick={toggleWhatsapp}
              className="flex w-full items-center gap-2.5 border-t border-stone-100 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              <MessageCircle size={16} className={profile.whatsapp_opt_in ? "text-emerald-600" : ""} />
              <span className="flex-1 text-left">WhatsApp updates</span>
              <span className={`text-xs font-semibold ${profile.whatsapp_opt_in ? "text-emerald-600" : "text-stone-400"}`}>{profile.whatsapp_opt_in ? "On" : "Off"}</span>
            </button>
          )}
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center gap-2.5 border-t border-stone-100 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-stone-800 dark:hover:bg-red-900/20"
            >
              <LogOut size={16} /> Log out
            </button>
          ) : (
            <div className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">
              <p className="text-sm text-stone-600 dark:text-stone-300">Log out? Your cart will be cleared.</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-stone-100 py-2 text-sm font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                  Cancel
                </button>
                <button onClick={logout} className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white">
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
