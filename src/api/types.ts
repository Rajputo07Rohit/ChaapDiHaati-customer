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
  packing_fee_paise?: number;
  discount_paise: number;
  /** Only ever set when status is CANCELLED/REFUNDED — why the restaurant denied/cancelled the order. */
  cancel_reason: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  /** Prep-time estimate (minutes) staff chose when accepting. */
  prep_time_minutes: number | null;
  /** Online payment refunded after a cancellation: PENDING (on its way) | SUCCESS | null. */
  refund_status: "PENDING" | "SUCCESS" | null;
  refund_amount_paise: number | null;
}

export interface OrderHistoryItem {
  menu_item_id: string;
  name: string;
  price_type: PriceType;
  quantity: number;
  unit_price_paise: number;
  line_subtotal_paise: number;
  special_instructions: string | null;
  addons: { name: string; unit_price_paise: number }[];
}

export interface OrderDetailRow extends OrderRow {
  delivery_address: string | null;
  items: OrderHistoryItem[];
  /** Only while the order is on its way. */
  rider: { name: string; phone: string | null } | null;
  /** The customer's own private rating, once given. */
  feedback: { rating: number; comment: string | null } | null;
}

export interface CustomerProfile {
  name: string | null;
  whatsapp_opt_in: boolean;
  whatsapp_available: boolean;
  addresses: { id: string; address: string; latitude: number | null; longitude: number | null }[];
}

export interface BusinessInfo {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  instagram: string;
  mapsUrl: string;
  reviewUrl?: string;
  pureVeg?: boolean;
  supportWhatsapp?: string;
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
