"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS } from "@/lib/cart";
import type { Customer, Sale, SaleItem, SaleType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type ClosePaymentType = "nakit" | "kart" | "havale" | "acik_hesap";
const PAYMENT_OPTIONS: ClosePaymentType[] = ["nakit", "kart", "havale", "acik_hesap"];

type ItemAction = "iade" | "sat" | null;

interface ItemRow {
  saleItemId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
  action: ItemAction;
}

interface CloseEmanetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale;
  items: SaleItem[];
  customer: Customer | null;
  onCompleted: () => void;
}

export function CloseEmanetSheet({
  open,
  onOpenChange,
  sale,
  items,
  customer,
  onCompleted,
}: CloseEmanetSheetProps) {
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [paymentType, setPaymentType] = useState<ClosePaymentType | null>(null);
  const [saving, setSaving] = useState(false);

  // Discount state
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<"percent" | "tl">("tl");
  const [discountInput, setDiscountInput] = useState("");

  useEffect(() => {
    if (open) {
      setPaymentType(null);
      setShowDiscount(false);
      setDiscountMode("tl");
      setDiscountInput("");
      setRows(
        items.map((si) => ({
          saleItemId: si.id,
          productId: si.product_id,
          productName: si.product_name,
          variantLabel: si.variant_label,
          quantity: si.quantity,
          unitPrice: si.unit_price,
          action: null,
        }))
      );
    }
  }, [open, items]);

  function setAction(idx: number, action: ItemAction) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, action } : r))
    );
    const updatedRows = rows.map((r, i) => (i === idx ? { ...r, action } : r));
    const hasSat = updatedRows.some((r) => r.action === "sat");
    if (!hasSat) {
      setPaymentType(null);
      setShowDiscount(false);
      setDiscountInput("");
    }
  }

  const iadeRows = rows.filter((r) => r.action === "iade");
  const satRows = rows.filter((r) => r.action === "sat");
  const undecidedRows = rows.filter((r) => r.action === null);
  const satTotal = satRows.reduce((s, r) => s + r.unitPrice * r.quantity, 0);
  const hasSat = satRows.length > 0;
  const allDecided = undecidedRows.length === 0 && rows.length > 0;

  const discountTL = (() => {
    const val = parseFloat(discountInput) || 0;
    if (val <= 0 || !hasSat) return 0;
    if (discountMode === "percent") {
      return Math.min(satTotal, (satTotal * Math.min(val, 100)) / 100);
    }
    return Math.min(satTotal, val);
  })();

  const discountedTotal = Math.max(0, satTotal - discountTL);
  const canConfirm = allDecided && (!hasSat || paymentType !== null);

  function clearDiscount() {
    setShowDiscount(false);
    setDiscountInput("");
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const supabase = getSupabase();

      for (const row of iadeRows) {
        if (row.variantLabel) {
          const { data: variants } = await supabase
            .from("product_variants")
            .select("id, stock")
            .eq("product_id", row.productId)
            .eq("size_label", row.variantLabel)
            .limit(1);

          if (variants && variants.length > 0) {
            const v = variants[0];
            await supabase
              .from("product_variants")
              .update({ stock: v.stock + row.quantity })
              .eq("id", v.id);
          }

          const { data: allV } = await supabase
            .from("product_variants")
            .select("stock")
            .eq("product_id", row.productId);
          if (allV) {
            const aggStock = allV.reduce((s, v) => s + v.stock, 0);
            await supabase
              .from("products")
              .update({ stock: aggStock })
              .eq("id", row.productId);
          }
        } else {
          const { data: prod } = await supabase
            .from("products")
            .select("stock")
            .eq("id", row.productId)
            .single();
          if (prod) {
            await supabase
              .from("products")
              .update({ stock: prod.stock + row.quantity })
              .eq("id", row.productId);
          }
        }

        await supabase
          .from("sale_items")
          .update({ returned_quantity: row.quantity })
          .eq("id", row.saleItemId);
      }

      const allReturned = satRows.length === 0;
      const finalType: SaleType = allReturned ? "nakit" : (paymentType as SaleType);
      const finalAmount = allReturned ? 0 : discountedTotal;

      const { error: saleErr } = await supabase
        .from("sales")
        .update({
          status: "completed",
          type: finalType,
          total_amount: finalAmount,
          discount_amount: discountTL,
        })
        .eq("id", sale.id);
      if (saleErr) throw saleErr;

      if (paymentType === "acik_hesap" && discountedTotal > 0 && customer) {
        const { data: cust } = await supabase
          .from("customers")
          .select("total_debt")
          .eq("id", customer.id)
          .single();
        if (cust) {
          await supabase
            .from("customers")
            .update({ total_debt: Number(cust.total_debt) + discountedTotal })
            .eq("id", customer.id);
        }
      }

      toast.success("Emanet tamamlandı ✓");
      onOpenChange(false);
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Emaneti Kapat</SheetTitle>
          <SheetDescription>
            Her ürün için &quot;İade&quot; veya &quot;Sat&quot; seçin
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-3 pt-2">

            {rows.map((row, idx) => (
              <div
                key={row.saleItemId}
                className={`rounded-xl border-2 p-3 transition-colors ${
                  row.action === "iade"
                    ? "border-amber-300 bg-amber-50"
                    : row.action === "sat"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-border bg-background"
                }`}
              >
                <div className="mb-3">
                  <p className="text-sm font-semibold">
                    {row.productName}
                    {row.variantLabel && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({row.variantLabel})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.quantity} adet · {formatTL(row.unitPrice)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAction(idx, row.action === "iade" ? null : "iade")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      row.action === "iade"
                        ? "bg-amber-500 text-white"
                        : "border border-amber-300 text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    <RotateCcw className="h-4 w-4" />
                    İade
                  </button>
                  <button
                    onClick={() => setAction(idx, row.action === "sat" ? null : "sat")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      row.action === "sat"
                        ? "bg-emerald-500 text-white"
                        : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Sat
                  </button>
                </div>
              </div>
            ))}

            {/* Summary */}
            {rows.length > 0 && (
              <div className="rounded-xl bg-secondary px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">İade edilecek</span>
                  <span className="font-medium text-amber-700">
                    {iadeRows.length} ürün
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Satılacak</span>
                  <span className="font-semibold text-emerald-700">
                    {hasSat ? `${satRows.length} ürün` : "0 ürün"}
                  </span>
                </div>
                {hasSat && (
                  <>
                    {discountTL > 0 ? (
                      <>
                        <div className="my-2 border-t border-dashed" />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ara Toplam</span>
                          <span>{formatTL(satTotal)}</span>
                        </div>
                        <div className="mt-1 flex justify-between text-red-600">
                          <span>İndirim</span>
                          <span>-{formatTL(discountTL)}</span>
                        </div>
                        <div className="my-2 border-t border-dashed" />
                        <div className="flex justify-between font-semibold">
                          <span>Toplam</span>
                          <span className="text-emerald-700">
                            {formatTL(discountedTotal)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 flex justify-between">
                        <span className="text-muted-foreground">Toplam</span>
                        <span className="font-semibold text-emerald-700">
                          {formatTL(satTotal)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {undecidedRows.length > 0 && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-muted-foreground">Karar verilmedi</span>
                    <span className="font-medium text-destructive">
                      {undecidedRows.length} ürün
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Payment type selector */}
            {hasSat && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ödeme Tipi
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map((type) => {
                    const info = SALE_TYPE_LABELS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setPaymentType(type)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition-colors ${
                          paymentType === type
                            ? "border-primary bg-primary/5"
                            : "border-input bg-background"
                        }`}
                      >
                        <span className="text-xl">{info.emoji}</span>
                        <span className="text-xs font-semibold">{info.label}</span>
                      </button>
                    );
                  })}
                </div>
                {paymentType === "acik_hesap" && customer && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-700">
                    Müşteri: <span className="font-semibold">{customer.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Discount section */}
            {hasSat && (
              <div>
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
                        max={discountMode === "percent" ? "100" : satTotal}
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-background px-4 py-3">
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
            {!allDecided
              ? `Tamamla (${undecidedRows.length} ürün kaldı)`
              : hasSat && !paymentType
              ? "Ödeme tipi seçin"
              : "Emaneti Tamamla"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
