export type PriceType = "HALF" | "FULL" | "SINGLE";

export interface MenuPriceRow {
  price_type: PriceType;
  price_paise: number;
}

export interface MenuItemRow {
  id: string;
  category_id: string;
  name: string;
  has_half: number;
  has_full: number;
  has_single: number;
  unit_label: string;
  half_label: string;
  full_label: string;
  status: "ACTIVE" | "UNAVAILABLE" | "DISCONTINUED";
  sort_order: number;
  prices: MenuPriceRow[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  items: MenuItemRow[];
}

export interface OrderRow {
  id: string;
  order_number: number;
  order_type: string;
  status: string;
  payment_status: string;
  net_total_paise: number;
  subtotal_paise: number;
  notes: string | null;
  created_at: string;
}
