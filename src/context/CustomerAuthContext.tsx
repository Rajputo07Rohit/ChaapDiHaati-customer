import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../api/client";

const STORAGE_KEY = "cdh_customer_auth";

interface StoredAuth {
  phone: string;
  token: string;
}

interface CustomerAuthContextValue {
  phone: string | null;
  isVerified: boolean;
  /**
   * Mock verification — no Firebase wired up yet on either the frontend or
   * backend (see backend/src/middleware/customerAuth.ts). This just
   * unblocks the browse → cart → checkout UI for local testing; real order
   * submission still needs a real Firebase ID token here once that's set up.
   */
  mockVerify: (phone: string) => void;
  signOut: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function loadStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(loadStored);

  useEffect(() => {
    setAuthToken(auth?.token ?? null);
  }, [auth]);

  function mockVerify(phone: string) {
    const next = { phone, token: `mock.${phone}.${Date.now()}` };
    setAuth(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort persistence only — session still works without it.
    }
  }

  function signOut() {
    setAuth(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  return (
    <CustomerAuthContext.Provider value={{ phone: auth?.phone ?? null, isVerified: !!auth, mockVerify, signOut }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
