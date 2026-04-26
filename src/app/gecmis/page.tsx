"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ReceiptText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS, DEBT_PAYMENT_TYPE_LABELS } from "@/lib/cart";
import type { DebtPaymentType, SaleType } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { ReceiptSheet } from "@/components/receipt-sheet";

type HistoryEntry =
  | {
      kind: "sale";
      id: string;
      type: SaleType;
      total_amount: number;
      created_at: string;
      customer_name: string | null;
      item_names: string;
    }
  | {
      kind: "payment";
      id: string;
      amount: number;
      created_at: string;
      customer_name: string | null;
      note: string | null;
      payment_type: DebtPaymentType | null;
    };

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

type FilterType = "all" | SaleType | "tahsilat";
const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "nakit", label: "Nakit" },
  { value: "kart", label: "Kart" },
  { value: "havale", label: "Havale" },
  { value: "acik_hesap", label: "Açık Hesap" },
  { value: "emanet", label: "Emanet" },
  { value: "tahsilat", label: "Tahsilat" },
];

export default function GecmisPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      const [salesRes, paymentsRes] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, type, total_amount, created_at, customers(name), sale_items(product_name)"
          )
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("debt_payments")
          .select("id, amount, created_at, note, payment_type, customers(name)")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (salesRes.error) throw salesRes.error;

      type CustomerRel = { name: string } | { name: string }[] | null;
      function resolveName(rel: CustomerRel): string | null {
        if (!rel) return null;
        if (Array.isArray(rel)) return rel[0]?.name ?? null;
        return (rel as { name: string }).name ?? null;
      }

      const allSales = (salesRes.data ?? []) as {
        id: string;
        type: SaleType;
        total_amount: number;
        created_at: string;
        customers: CustomerRel;
        sale_items: { product_name: string }[];
      }[];
      const allPayments = (paymentsRes.data ?? []) as {
        id: string;
        amount: number;
        created_at: string;
        note: string | null;
        payment_type: DebtPaymentType | null;
        customers: CustomerRel;
      }[];

      const saleEntries: HistoryEntry[] = allSales.map((s) => ({
        kind: "sale",
        id: s.id,
        type: s.type,
        total_amount: s.total_amount,
        created_at: s.created_at,
        customer_name: resolveName(s.customers),
        item_names: (s.sale_items ?? []).map((i) => i.product_name).join(" "),
      }));

      const paymentEntries: HistoryEntry[] = allPayments.map((p) => ({
        kind: "payment",
        id: p.id,
        amount: Number(p.amount),
        created_at: p.created_at,
        customer_name: resolveName(p.customers),
        note: p.note,
        payment_type: p.payment_type,
      }));

      const merged = [...saleEntries, ...paymentEntries].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEntries(merged);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    let result = entries;

    if (filter === "tahsilat") {
      result = result.filter((e) => e.kind === "payment");
    } else if (filter !== "all") {
      result = result.filter(
        (e) => e.kind === "sale" && e.type === filter
      );
    }

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter((e) => {
        if (e.customer_name && e.customer_name.toLowerCase().includes(q)) return true;
        if (e.kind === "sale" && e.item_names.toLowerCase().includes(q)) return true;
        if (e.kind === "payment" && e.note && e.note.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    return result;
  }, [entries, filter, search]);

  function openReceipt(saleId: string) {
    setReceiptSaleId(saleId);
    setReceiptOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">
            Satış Geçmişi
          </h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Müşteri, ürün veya not ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === opt.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground active:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-5">
              <ReceiptText className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="font-medium">
              {search || filter !== "all"
                ? "Sonuç bulunamadı"
                : "Henüz işlem yok"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-4">
            {filtered.map((entry) =>
              entry.kind === "sale" ? (
                <button
                  key={`s-${entry.id}`}
                  onClick={() => openReceipt(entry.id)}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-left transition-colors active:bg-accent"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">
                      {SALE_TYPE_LABELS[entry.type].emoji}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        {SALE_TYPE_LABELS[entry.type].label}
                        {entry.customer_name && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            · {entry.customer_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(new Date(entry.created_at))}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {formatTL(entry.total_amount)}
                  </span>
                </button>
              ) : (
                <div
                  key={`p-${entry.id}`}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">
                      {entry.payment_type
                        ? DEBT_PAYMENT_TYPE_LABELS[entry.payment_type].emoji
                        : "✅"}
                    </span>
                    <div>
                      <p className="text-sm font-medium">
                        Tahsilat
                        {entry.payment_type && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({DEBT_PAYMENT_TYPE_LABELS[entry.payment_type].label})
                          </span>
                        )}
                        {entry.customer_name && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            · {entry.customer_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(new Date(entry.created_at))}
                        {entry.note && (
                          <span className="ml-1">· {entry.note}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">
                    {formatTL(entry.amount)}
                  </span>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <ReceiptSheet
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        saleId={receiptSaleId}
      />
    </>
  );
}
