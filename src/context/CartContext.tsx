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
  /** Customer's note for the kitchen about this item ("no onion", "extra spicy"). */
  note?: string;
  /** An extra (cream, cheese…) meant for one dish only: the key and name of the cart line it goes with. The kitchen sees "For: <name>". */
  forKey?: string;
  forName?: string;
}

interface CartContextValue {
  lines: CartLine[];
  addItem: (item: Omit<CartLine, "key" | "quantity">, quantity: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  setNote: (key: string, note: string) => void;
  /** Points an extra at the dish it's for (or back to "whole order" with null). */
  attachExtra: (key: string, target: { key: string; name: string } | null) => void;
  /** Replaces the cart (used by "Reorder"). */
  replaceAll: (lines: CartLine[]) => void;
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

/** Same item + size + add-ons (+ the dish an extra is for) = one cart line. */
function lineKey(item: Pick<CartLine, "menuItemId" | "priceType" | "addons" | "forKey">): string {
  const addonKey = [...item.addons].map((a) => a.id).sort().join(",");
  return `${item.menuItemId}:${item.priceType}:${addonKey}${item.forKey ? `@${item.forKey}` : ""}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadStored);

  function update(next: CartLine[]) {
    setLines(next);
    persist(next);
  }

  function addItem(item: Omit<CartLine, "key" | "quantity">, quantity: number) {
    const key = lineKey(item);
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
    // Extras attached to a dish go with it.
    update(lines.filter((l) => l.key !== key && l.forKey !== key));
  }

  function attachExtra(key: string, target: { key: string; name: string } | null) {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    const moved = { ...line, forKey: target?.key, forName: target?.name };
    const newKey = lineKey(moved);
    const same = lines.find((l) => l.key === newKey && l.key !== key);
    // Already have this extra for that dish: merge the quantities into one line.
    update(
      same
        ? lines.filter((l) => l.key !== key).map((l) => (l.key === newKey ? { ...l, quantity: l.quantity + line.quantity } : l))
        : lines.map((l) => (l.key === key ? { ...moved, key: newKey } : l))
    );
  }

  function setNote(key: string, note: string) {
    update(lines.map((l) => (l.key === key ? { ...l, note: note.slice(0, 200) } : l)));
  }

  function replaceAll(next: CartLine[]) {
    update(next);
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
    <CartContext.Provider value={{ lines, addItem, setQuantity, removeItem, setNote, attachExtra, replaceAll, clear, totalPaise, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
