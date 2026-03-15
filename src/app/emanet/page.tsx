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
  returnedCount?: number;
  soldCount?: number;
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
          .eq("is_emanet", true)
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
      ]);

      const activeSales = (activeRes.data ?? []) as Sale[];
      const completedSales = (completedRes.data ?? []) as Sale[];
      const allSales = [...activeSales, ...completedSales];

      if (allSales.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const allSaleIds = allSales.map((s) => s.id);
      const completedIds = completedSales.map((s) => s.id);

      // Customer names
      const customerIds = Array.from(
        new Set(
          allSales
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

      // Fetch sale_items for all emanets
      const { data: allItems } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, returned_quantity")
        .in("sale_id", allSaleIds);

      const itemCountMap: Record<string, number> = {};
      const returnedMap: Record<string, number> = {};
      const soldMap: Record<string, number> = {};

      for (const raw of allItems ?? []) {
        const item = raw as { sale_id: string; quantity: number; returned_quantity: number };
        const sid = item.sale_id;
        itemCountMap[sid] = (itemCountMap[sid] ?? 0) + item.quantity;

        if (completedIds.includes(sid)) {
          const ret = item.returned_quantity ?? 0;
          returnedMap[sid] = (returnedMap[sid] ?? 0) + ret;
          soldMap[sid] = (soldMap[sid] ?? 0) + (item.quantity - ret);
        }
      }

      // Build rows
      const result: EmanetRow[] = [];

      for (const s of activeSales) {
        result.push({
          id: s.id,
          customerName: s.customer_id
            ? (customerMap[s.customer_id] ?? "Bilinmeyen")
            : "Müşteri yok",
          date: new Date(s.created_at),
          itemCount: itemCountMap[s.id] ?? 0,
          totalAmount: s.total_amount,
          status: "open",
        });
      }

      for (const s of completedSales) {
        result.push({
          id: s.id,
          customerName: s.customer_id
            ? (customerMap[s.customer_id] ?? "Bilinmeyen")
            : "Müşteri yok",
          date: new Date(s.created_at),
          itemCount: itemCountMap[s.id] ?? 0,
          totalAmount: s.total_amount,
          status: "completed",
          returnedCount: returnedMap[s.id] ?? 0,
          soldCount: soldMap[s.id] ?? 0,
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
            {historyRows.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted-foreground/20 px-1.5 text-xs font-semibold text-muted-foreground">
                {historyRows.length}
              </span>
            )}
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
                  {row.status === "completed" && (
                    <p className="mt-0.5 text-xs">
                      {row.soldCount === 0 ? (
                        <span className="text-amber-600">
                          ↩ Tamamı iade edildi
                        </span>
                      ) : row.returnedCount === 0 ? (
                        <span className="text-emerald-600">
                          ✓ Tamamı satıldı
                        </span>
                      ) : (
                        <>
                          <span className="text-amber-600">
                            ↩ {row.returnedCount} iade
                          </span>
                          <span className="mx-1 text-muted-foreground">·</span>
                          <span className="text-emerald-600">
                            ✓ {row.soldCount} satıldı
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    row.status === "open"
                      ? "text-violet-600"
                      : "text-emerald-600"
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
