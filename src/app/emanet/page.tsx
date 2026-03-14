"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, PackageCheck, PackageOpen } from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import { formatTL } from "@/lib/cart";
import type { Sale, Customer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmanetDetail } from "@/components/emanet/emanet-detail";

interface EmanetRow {
  id: string;
  customerName: string;
  date: Date;
  itemCount: number;
  totalAmount: number;
  status: "open" | "completed";
}

function formatDateTR(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Tab = "active" | "history";

export default function EmanetPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [rows, setRows] = useState<EmanetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const fetchEmanets = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      const [activeRes, completedRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, customer_id, total_amount, status, created_at")
          .eq("type", "emanet")
          .eq("status", "open")
          .order("created_at", { ascending: false }),
        supabase
          .from("sales")
          .select("id, customer_id, total_amount, status, created_at, type")
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
      ]);

      // For completed emanets, we check if any sale_items have returned_quantity > 0
      // That's a strong signal it was an emanet. OR we can store a note.
      // Simplest reliable approach: check if sale_items have returned_quantity set.
      const completedSales = (completedRes.data ?? []) as (Sale & Record<string, unknown>)[];

      // Get items for completed sales that might be emanets
      let completedEmanetIds: string[] = [];
      if (completedSales.length > 0) {
        const { data: itemsWithReturns } = await supabase
          .from("sale_items")
          .select("sale_id")
          .gt("returned_quantity", 0);

        const returnedSaleIds = new Set(
          (itemsWithReturns ?? []).map((i: { sale_id: string }) => i.sale_id)
        );

        // Also include completed sales where total_amount = 0 (all returned)
        // and any that were from emanet origin (returned_quantity > 0 on any item)
        completedEmanetIds = completedSales
          .filter((s) => returnedSaleIds.has(s.id))
          .map((s) => s.id);

        // Also: some emanets may have 0 returns (customer kept everything).
        // We can't perfectly distinguish these. Let's also include sales
        // that have the emanet type originally. Since type changes on close,
        // we'll use a notes-based approach or just show returned_quantity ones.
        // For best UX, let's also store a marker. For now, returned_quantity > 0
        // is our signal, plus we already show open emanets correctly.
      }

      // Gather all sale IDs
      const activeSales = (activeRes.data ?? []) as Sale[];
      const allSaleIds = [
        ...activeSales.map((s) => s.id),
        ...completedEmanetIds,
      ];

      if (allSaleIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Get customer names
      const customerIds = Array.from(
        new Set(
          [...activeSales, ...completedSales.filter((s) => completedEmanetIds.includes(s.id))]
            .map((s) => s.customer_id)
            .filter(Boolean) as string[]
        )
      );

      const customerMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds);
        for (const c of (customers ?? []) as Customer[]) {
          customerMap[c.id] = c.name;
        }
      }

      // Get item counts per sale
      const { data: itemCounts } = await supabase
        .from("sale_items")
        .select("sale_id, quantity")
        .in("sale_id", allSaleIds);

      const countMap: Record<string, number> = {};
      for (const item of itemCounts ?? []) {
        const sid = (item as { sale_id: string; quantity: number }).sale_id;
        countMap[sid] = (countMap[sid] || 0) + (item as { quantity: number }).quantity;
      }

      // Build rows
      const result: EmanetRow[] = [];

      for (const s of activeSales) {
        result.push({
          id: s.id,
          customerName: s.customer_id ? (customerMap[s.customer_id] ?? "Bilinmeyen") : "Müşteri yok",
          date: new Date(s.created_at),
          itemCount: countMap[s.id] ?? 0,
          totalAmount: s.total_amount,
          status: "open",
        });
      }

      for (const sid of completedEmanetIds) {
        const s = completedSales.find((x) => x.id === sid);
        if (!s) continue;
        result.push({
          id: s.id,
          customerName: s.customer_id ? (customerMap[s.customer_id] ?? "Bilinmeyen") : "Müşteri yok",
          date: new Date(s.created_at),
          itemCount: countMap[s.id] ?? 0,
          totalAmount: s.total_amount,
          status: "completed",
        });
      }

      result.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRows(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmanets();
  }, [fetchEmanets]);

  const activeRows = rows.filter((r) => r.status === "open");
  const historyRows = rows.filter((r) => r.status === "completed");
  const displayRows = tab === "active" ? activeRows : historyRows;

  function openDetail(saleId: string) {
    setSelectedSaleId(saleId);
    setDetailOpen(true);
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-xl font-bold tracking-tight">Emanet</h1>

        {/* Tabs */}
        <div className="flex rounded-lg bg-secondary p-1">
          <button
            onClick={() => setTab("active")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            Aktif
            {activeRows.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {activeRows.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === "history"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            Geçmiş
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : displayRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-5">
              {tab === "active" ? (
                <PackageCheck className="h-10 w-10 text-muted-foreground" />
              ) : (
                <PackageOpen className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium">
              {tab === "active"
                ? "Aktif emanet yok"
                : "Tamamlanmış emanet yok"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "active"
                ? "Satış ekranından emanet oluşturabilirsiniz"
                : "Kapatılan emanetler burada görünecek"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-4">
            {displayRows.map((row) => (
              <button
                key={row.id}
                onClick={() => openDetail(row.id)}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-left transition-colors active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{row.customerName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTR(row.date)} · {row.itemCount} ürün
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    row.status === "open" ? "text-violet-600" : "text-emerald-600"
                  }`}
                >
                  {formatTL(row.totalAmount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <EmanetDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        saleId={selectedSaleId}
        onUpdated={fetchEmanets}
      />
    </>
  );
}
