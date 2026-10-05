import { createContext, ReactNode, useContext, useState } from "react";

const STORAGE_KEY = "cdh_customer_session";

interface StoredSession {
  phone: string;
  token: string;
}

interface CustomerAuthContextValue {
  phone: string | null;
  token: string | null;
  isVerified: boolean;
  loading: boolean;
  setSession: (phone: string, token: string) => void;
  signOut: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function loadStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredSession | null>(loadStored);

  function setSession(phone: string, token: string) {
    const next = { phone, token };
    setSessionState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort persistence only — the session still works in-memory for this tab.
    }
  }

  function signOut() {
    setSessionState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage isn't available.
    }
  }

  return (
    <CustomerAuthContext.Provider
      value={{
        phone: session?.phone ?? null,
        token: session?.token ?? null,
        isVerified: !!session,
        loading: false,
        setSession,
        signOut,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
