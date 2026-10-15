import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, LogOut, User } from "lucide-react";
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

  function logout() {
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
        className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
      >
        <User size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-stone-900 dark:ring-white/10">
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
