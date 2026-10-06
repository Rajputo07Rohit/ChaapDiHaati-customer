export type PriceType = "HALF" | "FULL" | "SINGLE";

export interface MenuPriceRow {
  price_type: PriceType;
  price_paise: number;
}

export interface MenuItemAddonRow {
  id: string;
  name: string;
  price_paise: number;
  active: boolean;
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
  addons: MenuItemAddonRow[];
  image_url: string | null;
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
  delivery_fee_paise: number;
  discount_paise: number;
  /** Only ever set when status is CANCELLED/REFUNDED — why the restaurant denied/cancelled the order. */
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface OrderHistoryItem {
  name: string;
  price_type: PriceType;
  quantity: number;
  unit_price_paise: number;
  line_subtotal_paise: number;
  addons: { name: string; unit_price_paise: number }[];
}

export interface OrderDetailRow extends OrderRow {
  delivery_address: string | null;
  items: OrderHistoryItem[];
}

export interface PromoCodeOffer {
  code: string;
  description: string;
  discount_type: "FLAT" | "PERCENTAGE";
  discount_value: number;
  min_order_paise: number;
}

export interface AppliedPromo {
  code: string;
  description: string;
  discount_type: "FLAT" | "PERCENTAGE";
  discount_value: number;
  discount_paise: number;
}
