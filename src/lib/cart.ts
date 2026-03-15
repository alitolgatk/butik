import type { DebtPaymentType, SaleType } from "./types";

export interface CartItem {
  productId: string;
  productName: string;
  photoUrl: string | null;
  variantId: string | null;
  variantLabel: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

export function cartItemKey(item: CartItem): string {
  return item.variantId
    ? `${item.productId}:${item.variantId}`
    : item.productId;
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

export function formatTL(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);
}

export const SALE_TYPE_LABELS: Record<SaleType, { label: string; emoji: string }> = {
  nakit: { label: "Nakit", emoji: "💵" },
  kart: { label: "Kart", emoji: "💳" },
  havale: { label: "Havale", emoji: "🏦" },
  acik_hesap: { label: "Açık Hesap", emoji: "📒" },
  emanet: { label: "Emanet", emoji: "📦" },
};

export const DEBT_PAYMENT_TYPE_LABELS: Record<DebtPaymentType, { label: string; emoji: string }> = {
  nakit: { label: "Nakit", emoji: "💵" },
  kart: { label: "Kart", emoji: "💳" },
  havale: { label: "Havale", emoji: "🏦" },
};
