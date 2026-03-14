"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Loader2, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS } from "@/lib/cart";
import type { Customer, Sale, SaleItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function formatDateTR(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface ReceiptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
}

export function ReceiptSheet({ open, onOpenChange, saleId }: ReceiptSheetProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { data: saleData, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .single();
      if (error) throw error;
      const s = saleData as Sale;
      setSale(s);

      const { data: itemsData } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", saleId);
      setItems((itemsData ?? []) as SaleItem[]);

      if (s.customer_id) {
        const { data: custData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", s.customer_id)
          .single();
        setCustomer(custData as Customer | null);
      } else {
        setCustomer(null);
      }
    } catch {
      toast.error("Fiş yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    if (open && saleId) fetchData();
  }, [open, saleId, fetchData]);

  const subtotal = items.reduce(
    (s, i) => s + i.unit_price * i.quantity,
    0
  );
  const discount = sale?.discount_amount ?? 0;
  const hasDiscount = discount > 0;

  function buildPlainText(): string {
    if (!sale) return "";
    const lines: string[] = [];
    lines.push("Başak Butik");
    lines.push("Güzelyalı Mah. 81056 sok. no:11/c");
    lines.push("Çukurova ADANA");
    lines.push("");
    lines.push("SATIŞ NOTU");
    if (customer) {
      lines.push(`Müşteri: ${customer.name}`);
      if (customer.phone) lines.push(`Tel: ${customer.phone}`);
    }
    lines.push(`Tarih: ${formatDateTR(new Date(sale.created_at))}`);
    lines.push("─────────────────────────────");
    for (const item of items) {
      const label =
        item.product_name +
        (item.variant_label ? ` (${item.variant_label})` : "");
      lines.push(
        `${label}  ${item.quantity}  ${formatTL(item.unit_price * item.quantity)}`
      );
    }
    lines.push("─────────────────────────────");
    if (hasDiscount) {
      lines.push(`Ara Toplam: ${formatTL(subtotal)}`);
      lines.push(`İndirim: -${formatTL(discount)}`);
    }
    lines.push(`TOPLAM: ${formatTL(sale.total_amount)}`);
    lines.push("─────────────────────────────");
    lines.push(`Ödeme: ${SALE_TYPE_LABELS[sale.type].label}`);
    if (sale.type === "acik_hesap" && customer) {
      lines.push(`Güncel Borç: ${formatTL(customer.total_debt)}`);
    }
    lines.push("");
    lines.push("Teşekkür ederiz.");
    return lines.join("\n");
  }

  function handlePrint() {
    window.print();
  }

  async function handleShare() {
    const text = buildPlainText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Başak Butik - Satış Notu",
          text,
        });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Metin panoya kopyalandı");
      } catch {
        toast.error("Kopyalama başarısız");
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Satış Fişi</SheetTitle>
          <SheetDescription className="sr-only">Satış detayları</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sale ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Receipt card */}
              <div
                ref={receiptRef}
                id="receipt-content"
                className="mt-2 rounded-xl border bg-white p-5 font-mono text-xs leading-relaxed text-foreground"
              >
                <div className="text-center">
                  <p className="text-sm font-bold">Başak Butik</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Güzelyalı Mah. 81056 sok. no:11/c
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Çukurova ADANA
                  </p>
                </div>

                <div className="my-3 border-b border-dashed" />

                <p className="text-center text-[10px] font-semibold uppercase tracking-widest">
                  Satış Notu
                </p>

                <div className="mt-2 flex flex-col gap-0.5">
                  {customer && (
                    <>
                      <div className="flex justify-between">
                        <span>Müşteri:</span>
                        <span className="font-medium">{customer.name}</span>
                      </div>
                      {customer.phone && (
                        <div className="flex justify-between">
                          <span>Tel:</span>
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>Tarih:</span>
                    <span>{formatDateTR(new Date(sale.created_at))}</span>
                  </div>
                </div>

                <div className="my-3 border-b border-dashed" />

                {/* Items */}
                <div className="flex flex-col gap-1.5">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        {item.product_name}
                        {item.variant_label && ` (${item.variant_label})`}
                        {item.quantity > 1 && ` ×${item.quantity}`}
                      </span>
                      <span className="shrink-0 font-medium">
                        {formatTL(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="my-3 border-b border-dashed" />

                {/* Totals */}
                {hasDiscount && (
                  <>
                    <div className="flex justify-between">
                      <span>Ara Toplam:</span>
                      <span>{formatTL(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>İndirim:</span>
                      <span>-{formatTL(discount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span>TOPLAM:</span>
                  <span>{formatTL(sale.total_amount)}</span>
                </div>

                <div className="my-3 border-b border-dashed" />

                <div className="flex justify-between">
                  <span>Ödeme:</span>
                  <span className="font-medium">
                    {SALE_TYPE_LABELS[sale.type].emoji}{" "}
                    {SALE_TYPE_LABELS[sale.type].label}
                  </span>
                </div>

                {sale.type === "acik_hesap" && customer && (
                  <div className="mt-1 flex justify-between font-medium text-amber-700">
                    <span>Güncel Borç:</span>
                    <span>{formatTL(customer.total_debt)}</span>
                  </div>
                )}

                <p className="mt-4 text-center text-[10px] text-muted-foreground">
                  Teşekkür ederiz.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 border-t bg-background px-4 py-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                Yazdır
              </Button>
              <Button className="flex-1 gap-2" onClick={handleShare}>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
                  <Share2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Paylaş
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
