import { MenuCategory, OrderHistoryItem } from "../api/types";
import { CartLine } from "../context/CartContext";

/**
 * Rebuilds a past order as a fresh cart at today's prices. Anything no longer
 * on the menu (or no longer available in that size / with that add-on) is left
 * out and named, so the customer isn't surprised at checkout.
 */
export function buildReorderCart(items: OrderHistoryItem[], categories: MenuCategory[]): { lines: CartLine[]; skipped: string[] } {
  const menu = new Map(categories.flatMap((c) => c.items).map((i) => [i.id, i]));
  const lines: CartLine[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const current = menu.get(item.menu_item_id);
    const price = current?.prices.find((p) => p.price_type === item.price_type);
    if (!current || current.status !== "ACTIVE" || !price) {
      skipped.push(item.name);
      continue;
    }
    const addons = item.addons.map((a) => current.addons.find((m) => m.name === a.name && m.active));
    if (addons.some((a) => !a)) {
      skipped.push(`${item.name} (add-on)`);
      continue;
    }
    const picked = addons.map((a) => ({ id: a!.id, name: a!.name, pricePaise: a!.price_paise }));
    const key = `${current.id}:${item.price_type}:${picked.map((a) => a.id).sort().join(",")}`;
    const same = lines.find((l) => l.key === key);
    if (same) {
      same.quantity += item.quantity;
      continue;
    }
    lines.push({
      key,
      menuItemId: current.id,
      name: current.name,
      priceType: item.price_type,
      unitPricePaise: price.price_paise,
      quantity: item.quantity,
      addons: picked,
      note: item.special_instructions ?? undefined,
    });
  }
  return { lines, skipped };
}
