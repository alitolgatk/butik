"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL } from "@/lib/cart";
import type { Customer, SaleItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type RefundMethod = "cash" | "credit";

interface ReturnableItem {
  saleItemId: string;
  saleId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  unitPrice: number;
  maxReturnable: number;
  selectedQty: number;
  currentReturned: number;
}

interface ReturnSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onCompleted: () => void;
}

export function ReturnSheet({
  open,
  onOpenChange,
  customer,
  onCompleted,
}: ReturnSheetProps) {
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethod | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data: salesData } = await supabase
        .from("sales")
        .select("id, total_amount, sale_items(*)")
        .eq("customer_id", customer.id)
        .eq("status", "completed");

      const returnable: ReturnableItem[] = [];

      for (const sale of (salesData ?? []) as {
        id: string;
        total_amount: number;
        sale_items: SaleItem[];
      }[]) {
        for (const si of sale.sale_items) {
          const available = si.quantity - si.returned_quantity;
          if (available > 0) {
            returnable.push({
              saleItemId: si.id,
              saleId: sale.id,
              productId: si.product_id,
              productName: si.product_name,
              variantLabel: si.variant_label,
              unitPrice: si.unit_price,
              maxReturnable: available,
              selectedQty: 0,
              currentReturned: si.returned_quantity,
            });
          }
        }
      }

      setItems(returnable);
    } catch {
      toast.error("Ürünler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [customer.id]);

  useEffect(() => {
    if (open) {
      setRefundMethod(null);
      fetchItems();
    }
  }, [open, fetchItems]);

  function setQty(idx: number, qty: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, selectedQty: qty } : item
      )
    );
  }

  const selectedItems = items.filter((i) => i.selectedQty > 0);
  const totalReturnQty = selectedItems.reduce(
    (s, i) => s + i.selectedQty,
    0
  );
  const totalReturn = selectedItems.reduce(
    (s, i) => s + i.unitPrice * i.selectedQty,
    0
  );

  async function restoreStock(
    productId: string,
    variantLabel: string | null,
    qty: number
  ) {
    const supabase = getSupabase();

    if (variantLabel) {
      let matched = false;

      if (variantLabel.includes(" / ")) {
        const [colorPart, ...sizeParts] = variantLabel.split(" / ");
        const sizePart = sizeParts.join(" / ");
        const { data } = await supabase
          .from("product_variants")
          .select("id, stock")
          .eq("product_id", productId)
          .eq("color_label", colorPart)
          .eq("size_label", sizePart)
          .limit(1);
        if (data && data.length > 0) {
          await supabase
            .from("product_variants")
            .update({ stock: data[0].stock + qty })
            .eq("id", data[0].id);
          matched = true;
        }
      }

      if (!matched) {
        const { data } = await supabase
          .from("product_variants")
          .select("id, stock")
          .eq("product_id", productId)
          .eq("size_label", variantLabel)
          .limit(1);
        if (data && data.length > 0) {
          await supabase
            .from("product_variants")
            .update({ stock: data[0].stock + qty })
            .eq("id", data[0].id);
        }
      }

      const { data: allV } = await supabase
        .from("product_variants")
        .select("stock")
        .eq("product_id", productId);
      if (allV) {
        const aggStock = allV.reduce(
          (s, v) => s + (v as { stock: number }).stock,
          0
        );
        await supabase
          .from("products")
          .update({ stock: aggStock })
          .eq("id", productId);
      }
    } else {
      const { data: prod } = await supabase
        .from("products")
        .select("stock")
        .eq("id", productId)
        .single();
      if (prod) {
        await supabase
          .from("products")
          .update({
            stock: (prod as { stock: number }).stock + qty,
          })
          .eq("id", productId);
      }
    }
  }

  async function handleConfirm() {
    if (selectedItems.length === 0 || !refundMethod) return;
    setSaving(true);
    try {
      const supabase = getSupabase();

      // Common: update returned_quantity + restore stock
      for (const item of selectedItems) {
        await supabase
          .from("sale_items")
          .update({
            returned_quantity: item.currentReturned + item.selectedQty,
          })
          .eq("id", item.saleItemId);

        await restoreStock(
          item.productId,
          item.variantLabel,
          item.selectedQty
        );
      }

      if (refundMethod === "cash") {
        // Group return amounts by sale ID
        const deductionBySale: Record<string, number> = {};
        for (const item of selectedItems) {
          deductionBySale[item.saleId] =
            (deductionBySale[item.saleId] ?? 0) +
            item.unitPrice * item.selectedQty;
        }

        // Fetch current totals and apply deductions
        const saleIds = Object.keys(deductionBySale);
        for (const saleId of saleIds) {
          const { data: saleData } = await supabase
            .from("sales")
            .select("total_amount")
            .eq("id", saleId)
            .single();
          if (saleData) {
            await supabase
              .from("sales")
              .update({
                total_amount: Math.max(
                  0,
                  Number(saleData.total_amount) - deductionBySale[saleId]
                ),
              })
              .eq("id", saleId);
          }
        }

        toast.success(
          `İade alındı, ${formatTL(totalReturn)} satıştan düşüldü ✓`
        );
      } else {
        // Credit: reduce customer total_debt
        const { data: custData } = await supabase
          .from("customers")
          .select("total_debt")
          .eq("id", customer.id)
          .single();
        if (custData) {
          const newBalance = Number(custData.total_debt) - totalReturn;
          await supabase
            .from("customers")
            .update({ total_debt: newBalance })
            .eq("id", customer.id);

          if (newBalance < 0) {
            toast.success(
              `İade alındı, müşteri ${formatTL(Math.abs(newBalance))} alacaklı ✓`
            );
          } else {
            toast.success(
              `İade alındı, ${formatTL(totalReturn)} müşteri hesabına eklendi ✓`
            );
          }
        } else {
          toast.success("İade alındı ✓");
        }
      }

      onOpenChange(false);
      onCompleted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "İade işlemi başarısız"
      );
    } finally {
      setSaving(false);
    }
  }

  const canConfirm = selectedItems.length > 0 && refundMethod !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>İade Al</SheetTitle>
          <SheetDescription>
            İade edilecek ürünleri ve miktarları seçin
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RotateCcw className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">İade edilecek ürün yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bu müşteriye ait iade edilebilir ürün bulunamadı
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              {items.map((item, idx) => (
                <div
                  key={item.saleItemId}
                  className={`rounded-xl border-2 p-3 transition-colors ${
                    item.selectedQty > 0
                      ? "border-amber-300 bg-amber-50"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {item.productName}
                      {item.variantLabel && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({item.variantLabel})
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatTL(item.unitPrice)} · {item.maxReturnable} adet
                      iade edilebilir
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setQty(idx, Math.max(0, item.selectedQty - 1))
                        }
                        disabled={item.selectedQty === 0}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors disabled:opacity-30"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.selectedQty}
                      </span>
                      <button
                        onClick={() =>
                          setQty(
                            idx,
                            Math.min(
                              item.maxReturnable,
                              item.selectedQty + 1
                            )
                          )
                        }
                        disabled={item.selectedQty >= item.maxReturnable}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {item.selectedQty > 0 && (
                      <span className="text-sm font-semibold text-amber-700">
                        {formatTL(item.unitPrice * item.selectedQty)}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Refund method selector */}
              {selectedItems.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    İade Yöntemi
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setRefundMethod("cash")}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-colors ${
                        refundMethod === "cash"
                          ? "border-blue-400 bg-blue-50"
                          : "border-input bg-background"
                      }`}
                    >
                      <Banknote
                        className={`h-6 w-6 ${
                          refundMethod === "cash"
                            ? "text-blue-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          refundMethod === "cash"
                            ? "text-blue-700"
                            : "text-foreground"
                        }`}
                      >
                        Parayı İade Et
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Nakit / Kart / Havale
                      </span>
                    </button>
                    <button
                      onClick={() => setRefundMethod("credit")}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-colors ${
                        refundMethod === "credit"
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-input bg-background"
                      }`}
                    >
                      <UserCheck
                        className={`h-6 w-6 ${
                          refundMethod === "credit"
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          refundMethod === "credit"
                            ? "text-emerald-700"
                            : "text-foreground"
                        }`}
                      >
                        Hesabına Ekle
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Müşteri alacaklı olur
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary + confirm */}
        {selectedItems.length > 0 && (
          <div className="border-t bg-background px-4 py-3">
            <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 text-center text-sm text-amber-700">
              <p className="font-semibold">
                {totalReturnQty} ürün iade · {formatTL(totalReturn)}
              </p>
              {refundMethod === "cash" && (
                <p className="mt-0.5 text-xs">
                  💵 Tutar satıştan düşülecek
                </p>
              )}
              {refundMethod === "credit" && (
                <p className="mt-0.5 text-xs">
                  ✅ Müşteri hesabına eklenecek
                </p>
              )}
              {!refundMethod && (
                <p className="mt-0.5 text-xs">
                  İade yöntemi seçin
                </p>
              )}
            </div>
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || saving}
              className="h-11 w-full gap-2 font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {!refundMethod
                ? "İade yöntemi seçin"
                : "İadeyi Onayla"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
