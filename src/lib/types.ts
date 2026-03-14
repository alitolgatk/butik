export interface Product {
  id: string;
  name: string;
  photo_url: string | null;
  price: number;
  has_variants: boolean;
  stock: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_label: string;
  color_label: string | null;
  stock: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  total_debt: number;
  created_at: string;
}

export type SaleType = "nakit" | "kart" | "havale" | "acik_hesap" | "emanet";
export type SaleStatus = "completed" | "open";

export interface Sale {
  id: string;
  type: SaleType;
  customer_id: string | null;
  total_amount: number;
  discount_amount: number;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  variant_label: string | null;
  quantity: number;
  unit_price: number;
  returned_quantity: number;
}

export interface DebtPayment {
  id: string;
  customer_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}
