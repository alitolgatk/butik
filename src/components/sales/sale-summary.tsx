"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import type { CartItem } from "@/lib/cart";
import { cartTotal, formatTL, SALE_TYPE_LABELS } from "@/lib/cart";
import type { Customer, SaleType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface SaleSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
  saleType: SaleType;
  customer: Customer | null;
  onCompleted: () => void;
}

export function SaleSummary({
  open,
  onOpenChange,
  items,
  saleType,
  customer,
  onCompleted,
}: SaleSummaryProps) {
  const [saving, setSaving] = useState(false);
  const subtotal = cartTotal(items);
  const typeInfo = SALE_TYPE_LABELS[saleType];

  // Discount state
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<"percent" | "tl">("tl");
  const [discountInput, setDiscountInput] = useState("");

  const discountTL = (() => {
    const val = parseFloat(discountInput) || 0;
    if (val <= 0) return 0;
    if (discountMode === "percent") {
      return Math.min(subtotal, (subtotal * Math.min(val, 100)) / 100);
    }
    return Math.min(subtotal, val);
  })();

  const finalTotal = Math.max(0, subtotal - discountTL);

  function clearDiscount() {
    setShowDiscount(false);
    setDiscountInput("");
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const supabase = getSupabase();

      const isEmanet = saleType === "emanet";
      const saleStatus = isEmanet ? "open" : "completed";

      // 1. Insert sale
      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          type: saleType,
          customer_id: customer?.id ?? null,
          total_amount: finalTotal,
          discount_amount: discountTL,
          status: saleStatus,
        })
        .select("id")
        .single();
      if (saleErr) throw saleErr;

      // 2. Insert sale items
      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.productId,
        product_name: item.productName,
        variant_label: item.variantLabel,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const { error: itemsErr } = await supabase
        .from("sale_items")
        .insert(saleItems);
      if (itemsErr) throw itemsErr;

      // 3. Reduce stock
      for (const item of items) {
        if (item.variantId) {
          const { error } = await supabase.rpc("decrement_variant_stock", {
            p_variant_id: item.variantId,
            p_qty: item.quantity,
          });
          if (error) {
            const { data: current } = await supabase
              .from("product_variants")
              .select("stock")
              .eq("id", item.variantId)
              .single();
            if (current) {
              await supabase
                .from("product_variants")
                .update({ stock: Math.max(0, current.stock - item.quantity) })
                .eq("id", item.variantId);
            }
          }
          const { data: allVariants } = await supabase
            .from("product_variants")
            .select("stock")
            .eq("product_id", item.productId);
          if (allVariants) {
            const totalStock = allVariants.reduce((s, v) => s + v.stock, 0);
            await supabase
              .from("products")
              .update({ stock: totalStock })
              .eq("id", item.productId);
          }
        } else {
          const { data: current } = await supabase
            .from("products")
            .select("stock")
            .eq("id", item.productId)
            .single();
          if (current) {
            await supabase
              .from("products")
              .update({ stock: Math.max(0, current.stock - item.quantity) })
              .eq("id", item.productId);
          }
        }
      }

      // 4. If acik_hesap, update customer debt (use final discounted total)
      if (saleType === "acik_hesap" && customer) {
        const { data: cust } = await supabase
          .from("customers")
          .select("total_debt")
          .eq("id", customer.id)
          .single();
        if (cust) {
          await supabase
            .from("customers")
            .update({ total_debt: Number(cust.total_debt) + finalTotal })
            .eq("id", customer.id);
        }
      }

      toast.success("Satış tamamlandı ✓");
      clearDiscount();
      onOpenChange(false);
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Satış kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[85dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Satış Özeti</SheetTitle>
          <SheetDescription>Satışı onaylamadan önce kontrol edin</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-3">
          {/* Payment type badge */}
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
            <span className="text-lg">{typeInfo.emoji}</span>
            <span className="text-sm font-semibold">{typeInfo.label}</span>
            {customer && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {customer.name}
                </span>
              </>
            )}
          </div>

          {/* Items */}
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {item.productName}
                    {item.variantLabel && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({item.variantLabel})
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.quantity} × {formatTL(item.unitPrice)}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatTL(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Discount section */}
          <div className="mt-3">
            {!showDiscount ? (
              <button
                onClick={() => setShowDiscount(true)}
                className="w-full rounded-lg border-2 border-dashed border-input px-3 py-2.5 text-center text-sm font-medium text-muted-foreground transition-colors active:border-primary active:text-primary"
              >
                + İndirim Ekle
              </button>
            ) : (
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">İndirim</span>
                  <button
                    onClick={clearDiscount}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                    Kaldır
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {/* Mode toggle */}
                  <div className="flex shrink-0 overflow-hidden rounded-md border">
                    <button
                      onClick={() => setDiscountMode("percent")}
                      className={`flex h-9 w-10 items-center justify-center text-xs font-semibold transition-colors ${
                        discountMode === "percent"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => setDiscountMode("tl")}
                      className={`flex h-9 w-10 items-center justify-center text-xs font-semibold transition-colors ${
                        discountMode === "tl"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      ₺
                    </button>
                  </div>

                  <Input
                    type="number"
                    min="0"
                    step={discountMode === "percent" ? "1" : "0.01"}
                    max={discountMode === "percent" ? "100" : subtotal}
                    placeholder="0"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                </div>

                {discountTL > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    İndirim tutarı: -{formatTL(discountTL)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="mt-4 rounded-xl bg-primary/5 px-4 py-3">
            {discountTL > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ara Toplam</span>
                  <span>{formatTL(subtotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-red-600">
                  <span>İndirim</span>
                  <span>-{formatTL(discountTL)}</span>
                </div>
                <div className="my-2 border-b border-dashed" />
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="font-semibold">Toplam</span>
              <span className="text-xl font-bold text-primary">
                {formatTL(finalTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Confirm button */}
        <div className="border-t bg-background px-4 py-3">
          <Button
            onClick={handleConfirm}
            disabled={saving}
            className="h-12 w-full gap-2 text-base font-semibold"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            Satışı Tamamla
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
