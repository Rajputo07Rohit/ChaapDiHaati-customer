import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Menu } from "./pages/Menu";
import { Verify } from "./pages/Verify";
import { OrderConfirmation } from "./pages/OrderConfirmation";
import { OrderHistory } from "./pages/OrderHistory";
import { useCustomerAuth } from "./context/CustomerAuthContext";
import { useStoreStatusPolling } from "./hooks";
import { useEffect } from "react";
import { OfflineBanner } from "./components/AppBanners";
import { refreshPushSubscription } from "./utils/push";

/** Phone verification gates the whole app — nothing past it (menu, cart, checkout) is reachable until it's done. */
function RequireCustomerAuth({ children }: { children: JSX.Element }) {
  const { isVerified, loading } = useCustomerAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-stone-400">Loading…</div>;
  if (!isVerified) return <Navigate to="/verify" replace />;
  return children;
}

/**
 * On a phone this is invisible (the shell IS the viewport). On a tablet or
 * desktop browser it keeps the app at a phone-like width, centered, with a
 * visible edge — instead of a single column of text/buttons stretched
 * across a 1440px window, which is what every page looked like without it.
 */
export default function App() {
  useStoreStatusPolling();
  const { phone } = useCustomerAuth();
  // A browser that already allowed notifications is re-linked to whoever is signed in now.
  useEffect(() => {
    if (phone) void refreshPushSubscription();
  }, [phone]);
  // Every page scales with the screen instead of staying a phone-width column:
  // the menu and order list are browsing grids that use the laptop width, the
  // order status page is a roomier centred card, and the login screen is full-bleed.
  const { pathname } = useLocation();
  const widthClass = pathname.startsWith("/menu")
    ? "sm:max-w-3xl lg:max-w-6xl xl:max-w-7xl"
    : pathname.startsWith("/orders")
      ? "sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl"
      : "sm:max-w-lg lg:max-w-2xl";
  // The login screen is a full-bleed split layout (brand panel + form) on laptops.
  const fullBleed = pathname.startsWith("/verify");
  return (
    <div className="min-h-screen bg-stone-200 dark:bg-stone-900">
    <OfflineBanner />
    <div className="sm:flex sm:justify-center">
      <div
        className={`w-full ${
          fullBleed ? "" : `sm:shadow-2xl ${widthClass}`
        }`}
      >
        <Routes>
          <Route path="/verify" element={<Verify />} />
          <Route
            path="/menu"
            element={
              <RequireCustomerAuth>
                <Menu />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/order/:id"
            element={
              <RequireCustomerAuth>
                <OrderConfirmation />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireCustomerAuth>
                <OrderHistory />
              </RequireCustomerAuth>
            }
          />
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </div>
    </div>
    </div>
  );
}
