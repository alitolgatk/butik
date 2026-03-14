"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ReceiptText, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS } from "@/lib/cart";
import type { SaleType } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { ReceiptSheet } from "@/components/receipt-sheet";

interface HistoryRow {
  id: string;
  type: SaleType;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
  item_names: string;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

type FilterType = "all" | SaleType;
const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "nakit", label: "Nakit" },
  { value: "kart", label: "Kart" },
  { value: "havale", label: "Havale" },
  { value: "acik_hesap", label: "Açık Hesap" },
  { value: "emanet", label: "Emanet" },
];

export default function GecmisPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      const { data: sales, error } = await supabase
        .from("sales")
        .select("id, type, total_amount, created_at, customer_id")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const allSales = (sales ?? []) as {
        id: string;
        type: SaleType;
        total_amount: number;
        created_at: string;
        customer_id: string | null;
      }[];

      // customer names
      const custIds = Array.from(
        new Set(allSales.map((s) => s.customer_id).filter(Boolean) as string[])
      );
      const nameMap: Record<string, string> = {};
      if (custIds.length > 0) {
        const { data: custs } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", custIds);
        for (const c of custs ?? []) {
          nameMap[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name;
        }
      }

      // item names for search
      const saleIds = allSales.map((s) => s.id);
      const itemNameMap: Record<string, string> = {};
      if (saleIds.length > 0) {
        const { data: items } = await supabase
          .from("sale_items")
          .select("sale_id, product_name")
          .in("sale_id", saleIds);
        const grouped: Record<string, string[]> = {};
        for (const item of items ?? []) {
          const i = item as { sale_id: string; product_name: string };
          if (!grouped[i.sale_id]) grouped[i.sale_id] = [];
          grouped[i.sale_id].push(i.product_name);
        }
        for (const [sid, names] of Object.entries(grouped)) {
          itemNameMap[sid] = names.join(" ");
        }
      }

      setRows(
        allSales.map((s) => ({
          id: s.id,
          type: s.type,
          total_amount: s.total_amount,
          created_at: s.created_at,
          customer_name: s.customer_id ? nameMap[s.customer_id] ?? null : null,
          item_names: itemNameMap[s.id] ?? "",
        }))
      );
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
    let result = rows;
    if (filter !== "all") {
      result = result.filter((r) => r.type === filter);
    }
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (r) =>
          (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
          r.item_names.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filter, search]);

  function openReceipt(saleId: string) {
    setReceiptSaleId(saleId);
    setReceiptOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        {/* Header with back */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Satış Geçmişi</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Müşteri veya ürün ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter tabs */}
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

        {/* List */}
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
              {search || filter !== "all" ? "Sonuç bulunamadı" : "Henüz satış yok"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-4">
            {filtered.map((sale) => (
              <button
                key={sale.id}
                onClick={() => openReceipt(sale.id)}
                className="flex items-center justify-between rounded-lg px-2 py-2.5 text-left transition-colors active:bg-accent"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">
                    {SALE_TYPE_LABELS[sale.type].emoji}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {SALE_TYPE_LABELS[sale.type].label}
                      {sale.customer_name && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          · {sale.customer_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(new Date(sale.created_at))}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-primary">
                  {formatTL(sale.total_amount)}
                </span>
              </button>
            ))}
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
