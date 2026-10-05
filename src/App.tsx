import { Navigate, Route, Routes } from "react-router-dom";
import { Menu } from "./pages/Menu";
import { Verify } from "./pages/Verify";
import { OrderConfirmation } from "./pages/OrderConfirmation";
import { useCustomerAuth } from "./context/CustomerAuthContext";

/** Phone verification gates the whole app — nothing past it (menu, cart, checkout) is reachable until it's done. */
function RequireCustomerAuth({ children }: { children: JSX.Element }) {
  const { isVerified, loading } = useCustomerAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-stone-400">Loading…</div>;
  if (!isVerified) return <Navigate to="/verify" replace />;
  return children;
}

export default function App() {
  return (
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
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}
