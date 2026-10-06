import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Menu } from "./pages/Menu";
import { Verify } from "./pages/Verify";
import { OrderConfirmation } from "./pages/OrderConfirmation";
import { OrderHistory } from "./pages/OrderHistory";
import { useCustomerAuth } from "./context/CustomerAuthContext";

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
  // The menu is a browsing grid and uses the full desktop width; the other pages are single-column forms/receipts and stay phone-width.
  const wide = useLocation().pathname.startsWith("/menu");
  return (
    <div className="min-h-screen bg-stone-200 dark:bg-stone-900 sm:flex sm:justify-center">
      <div className={`w-full sm:shadow-2xl ${wide ? "sm:max-w-3xl lg:max-w-6xl" : "sm:max-w-md"}`}>
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
  );
}
