import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { CartProvider } from "./context/CartContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // Weak mobile signal is the norm — retry a couple of times with backoff before showing an error.
    queries: { retry: 2, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), staleTime: 30_000 },
  },
});

// Offline shell + order-update push notifications (see public/sw.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <CustomerAuthProvider>
            <CartProvider>
              <App />
              <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
            </CartProvider>
          </CustomerAuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
