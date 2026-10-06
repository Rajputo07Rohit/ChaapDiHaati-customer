import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { PriceType } from "../api/types";

const STORAGE_KEY = "cdh_cart";

export interface CartLineAddon {
  id: string;
  name: string;
  pricePaise: number;
}

export interface CartLine {
  menuItemId: string;
  name: string;
  priceType: PriceType;
  /** The item's own price — selected add-ons are tracked separately below, not folded in here. */
  unitPricePaise: number;
  quantity: number;
  addons: CartLineAddon[];
  /** Distinguishes e.g. the same item added as HALF vs FULL, or with different add-ons selected, as separate cart lines. */
  key: string;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (item: Omit<CartLine, "key" | "quantity">, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  totalPaise: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadStored(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Carts saved before add-ons existed have no `addons` field.
    return parsed.map((l) => ({ ...l, addons: Array.isArray(l.addons) ? l.addons : [] }));
  } catch {
    return [];
  }
}

function persist(lines: CartLine[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Best-effort — cart still works in-memory for this session.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadStored);

  function update(next: CartLine[]) {
    setLines(next);
    persist(next);
  }

  function addItem(item: Omit<CartLine, "key" | "quantity">, quantity: number) {
    const addonKey = [...item.addons].map((a) => a.id).sort().join(",");
    const key = `${item.menuItemId}:${item.priceType}:${addonKey}`;
    const existing = lines.find((l) => l.key === key);
    if (existing) {
      update(lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l)));
    } else {
      update([...lines, { ...item, key, quantity }]);
    }
  }

  function setQuantity(key: string, quantity: number) {
    if (quantity <= 0) return removeItem(key);
    update(lines.map((l) => (l.key === key ? { ...l, quantity } : l)));
  }

  function removeItem(key: string) {
    update(lines.filter((l) => l.key !== key));
  }

  function clear() {
    update([]);
  }

  const totalPaise = useMemo(
    () => lines.reduce((sum, l) => sum + (l.unitPricePaise + l.addons.reduce((s, a) => s + a.pricePaise, 0)) * l.quantity, 0),
    [lines]
  );
  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  return (
    <CartContext.Provider value={{ lines, addItem, setQuantity, removeItem, clear, totalPaise, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
