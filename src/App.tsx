import { Navigate, Route, Routes } from "react-router-dom";
import { Menu } from "./pages/Menu";
import { Cart } from "./pages/Cart";
import { Verify } from "./pages/Verify";
import { OrderConfirmation } from "./pages/OrderConfirmation";

export default function App() {
  return (
    <Routes>
      <Route path="/menu" element={<Menu />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/order/:id" element={<OrderConfirmation />} />
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}
