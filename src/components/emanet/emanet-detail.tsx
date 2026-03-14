"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, Phone, User } from "lucide-react";
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
import { CloseEmanetSheet } from "./close-emanet-sheet";

function formatDateTR(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface EmanetDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string | null;
  onUpdated: () => void;
}

export function EmanetDetail({
  open,
  onOpenChange,
  saleId,
  onUpdated,
}: EmanetDetailProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeOpen, setCloseOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: saleData, error: saleErr } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .single();
      if (saleErr) throw saleErr;

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
      toast.error("Emanet detayı yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    if (open && saleId) {
      fetchData();
    }
  }, [open, saleId, fetchData]);

  function handleCloseCompleted() {
    fetchData();
    onUpdated();
  }

  const isActive = sale?.status === "open";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[88dvh] flex-col rounded-t-2xl"
        >
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Emanet Detayı</SheetTitle>
            <SheetDescription className="sr-only">
              Emanet bilgileri
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sale ? (
            <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
              {/* Header info */}
              <div className="flex flex-col gap-2 pt-2">
                {customer && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {customer.name}
                    </div>
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {customer.phone}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  Verildi: {formatDateTR(new Date(sale.created_at))}
                </div>

                {/* Status badge */}
                <div
                  className={`mt-1 rounded-xl px-4 py-3 text-center ${
                    isActive ? "bg-violet-50" : "bg-emerald-50"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      isActive ? "text-violet-600" : "text-emerald-600"
                    }`}
                  >
                    {isActive ? "Aktif Emanet" : "Tamamlandı"}
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      isActive ? "text-violet-700" : "text-emerald-700"
                    }`}
                  >
                    {formatTL(sale.total_amount)}
                  </p>
                </div>

                {/* Completed sale: show payment type used */}
                {!isActive && sale.type !== "emanet" && (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    <span>{SALE_TYPE_LABELS[sale.type].emoji}</span>
                    <span className="font-medium">
                      {SALE_TYPE_LABELS[sale.type].label}
                    </span>
                  </div>
                )}
              </div>

              {/* Items list */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ürünler
                </p>
                <div className="flex flex-col gap-1.5">
                  {items.map((si) => {
                    const kept = si.quantity - si.returned_quantity;
                    return (
                      <div
                        key={si.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">
                            {si.product_name}
                            {si.variant_label && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({si.variant_label})
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {si.quantity} adet × {formatTL(si.unit_price)}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className="text-sm font-semibold">
                            {formatTL(si.unit_price * si.quantity)}
                          </span>
                          {/* Show returned/kept for completed */}
                          {!isActive && si.returned_quantity > 0 && (
                            <div className="flex gap-2 text-xs">
                              <span className="text-amber-600">
                                ↩ {si.returned_quantity} iade
                              </span>
                              {kept > 0 && (
                                <span className="text-emerald-600">
                                  ✓ {kept} satıldı
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer: close button for active emanets */}
          {sale && isActive && !loading && (
            <div className="border-t bg-background px-4 py-3">
              <Button
                onClick={() => setCloseOpen(true)}
                className="h-11 w-full font-semibold"
              >
                Emaneti Kapat
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Close emanet sub-sheet */}
      {sale && isActive && (
        <CloseEmanetSheet
          open={closeOpen}
          onOpenChange={setCloseOpen}
          sale={sale}
          items={items}
          customer={customer}
          onCompleted={handleCloseCompleted}
        />
      )}
    </>
  );
}
