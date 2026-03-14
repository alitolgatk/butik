"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  PackageCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS } from "@/lib/cart";
import type { SaleType } from "@/lib/types";
import { ReceiptSheet } from "@/components/receipt-sheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ─── Helpers ───

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function formatClock(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const day = DAY_NAMES[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm} ${day} ${hh}:${min}`;
}

// ─── Types ───

interface DashboardData {
  todaySalesCount: number;
  todaySalesTotal: number;
  activeDebtCount: number;
  activeEmanetCount: number;
}

interface RecentSale {
  id: string;
  type: SaleType;
  total_amount: number;
  created_at: string;
  customer_name: string | null;
}

interface StatsData {
  totalRevenue: number;
  saleCount: number;
  breakdown: { type: SaleType; total: number }[];
}

const BREAKDOWN_COLORS: Partial<Record<SaleType, string>> = {
  nakit: "bg-emerald-500",
  kart: "bg-blue-500",
  havale: "bg-violet-500",
  acik_hesap: "bg-amber-500",
};

// ─── Component ───

export default function HomePage() {
  const [data, setData] = useState<DashboardData>({
    todaySalesCount: 0,
    todaySalesTotal: 0,
    activeDebtCount: 0,
    activeEmanetCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recent sales
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);

  // Stats
  const now = new Date();
  const [statsMonth, setStatsMonth] = useState(now.getMonth());
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [clock, setClock] = useState(now);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [customRange, setCustomRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [stats, setStats] = useState<StatsData>({
    totalRevenue: 0,
    saleCount: 0,
    breakdown: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // ─── Fetch dashboard cards + recent ───
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const supabase = getSupabase();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [salesRes, debtRes, emanetRes, recentRes] = await Promise.all([
          supabase
            .from("sales")
            .select("total_amount")
            .gte("created_at", todayStart.toISOString())
            .neq("type", "emanet"),
          supabase.from("customers").select("id").gt("total_debt", 0),
          supabase
            .from("sales")
            .select("id")
            .eq("type", "emanet")
            .eq("status", "open"),
          supabase
            .from("sales")
            .select("id, type, total_amount, created_at, customer_id")
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        const sales = salesRes.data ?? [];
        const totalAmount = sales.reduce(
          (sum, s) => sum + Number(s.total_amount),
          0
        );

        setData({
          todaySalesCount: sales.length,
          todaySalesTotal: totalAmount,
          activeDebtCount: debtRes.data?.length ?? 0,
          activeEmanetCount: emanetRes.data?.length ?? 0,
        });

        // Resolve customer names for recent
        const recent = (recentRes.data ?? []) as {
          id: string;
          type: SaleType;
          total_amount: number;
          created_at: string;
          customer_id: string | null;
        }[];

        const customerIds = Array.from(
          new Set(recent.map((r) => r.customer_id).filter(Boolean) as string[])
        );
        const nameMap: Record<string, string> = {};
        if (customerIds.length > 0) {
          const { data: custs } = await supabase
            .from("customers")
            .select("id, name")
            .in("id", customerIds);
          for (const c of custs ?? []) {
            nameMap[(c as { id: string; name: string }).id] = (c as { id: string; name: string }).name;
          }
        }

        setRecentSales(
          recent.map((r) => ({
            id: r.id,
            type: r.type,
            total_amount: r.total_amount,
            created_at: r.created_at,
            customer_name: r.customer_id ? nameMap[r.customer_id] ?? null : null,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Veri yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  // ─── Fetch stats ───
  const statsPeriod = useMemo(() => {
    if (customRange && rangeFrom && rangeTo) {
      return {
        from: new Date(rangeFrom + "T00:00:00").toISOString(),
        to: new Date(rangeTo + "T23:59:59").toISOString(),
        label: "Seçili Dönem",
      };
    }
    const from = new Date(statsYear, statsMonth, 1);
    const to = new Date(statsYear, statsMonth + 1, 0, 23, 59, 59);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${MONTH_NAMES[statsMonth]} ${statsYear}`,
    };
  }, [customRange, rangeFrom, rangeTo, statsMonth, statsYear]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("sales")
        .select("type, total_amount")
        .eq("status", "completed")
        .gte("created_at", statsPeriod.from)
        .lte("created_at", statsPeriod.to)
        .gt("total_amount", 0);

      if (error) throw error;

      const rows = (data ?? []) as { type: SaleType; total_amount: number }[];
      const totalRevenue = rows.reduce((s, r) => s + Number(r.total_amount), 0);
      const typeMap: Partial<Record<SaleType, number>> = {};
      for (const r of rows) {
        typeMap[r.type] = (typeMap[r.type] ?? 0) + Number(r.total_amount);
      }
      const breakdown = Object.entries(typeMap)
        .map(([type, total]) => ({ type: type as SaleType, total: total as number }))
        .sort((a, b) => b.total - a.total);

      setStats({ totalRevenue, saleCount: rows.length, breakdown });
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, [statsPeriod]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function prevMonth() {
    setCustomRange(false);
    if (statsMonth === 0) {
      setStatsMonth(11);
      setStatsYear((y) => y - 1);
    } else {
      setStatsMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    setCustomRange(false);
    if (statsMonth === 11) {
      setStatsMonth(0);
      setStatsYear((y) => y + 1);
    } else {
      setStatsMonth((m) => m + 1);
    }
  }

  function applyCustomRange() {
    if (rangeFrom && rangeTo) {
      setCustomRange(true);
      setRangePickerOpen(false);
    }
  }

  function openReceipt(saleId: string) {
    setReceiptSaleId(saleId);
    setReceiptOpen(true);
  }

  // ─── Render ───
  return (
    <>
      <div className="flex flex-col gap-5 px-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Başak Butik</h1>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatClock(clock)}
          </span>
        </div>

        {error && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-800">
              <p className="font-medium">Supabase bağlantısı kurulamadı</p>
              <p className="mt-1 text-xs opacity-80">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid gap-3">
          <SummaryCard
            icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
            title="Bugünkü Satışlar"
            loading={loading && !error}
            primaryValue={formatTL(data.todaySalesTotal)}
            secondaryValue={`${data.todaySalesCount} adet`}
            bgClass="bg-emerald-50"
          />
          <SummaryCard
            icon={<BookOpen className="h-5 w-5 text-amber-600" />}
            title="Aktif Açık Hesaplar"
            loading={loading && !error}
            primaryValue={`${data.activeDebtCount}`}
            secondaryValue="müşteri"
            bgClass="bg-amber-50"
          />
          <SummaryCard
            icon={<PackageCheck className="h-5 w-5 text-violet-600" />}
            title="Aktif Emanetler"
            loading={loading && !error}
            primaryValue={`${data.activeEmanetCount}`}
            secondaryValue="adet"
            bgClass="bg-violet-50"
          />
        </div>

        {/* ───── İstatistik ───── */}
        <div>
          <p className="mb-3 text-sm font-semibold">İstatistik</p>

          {/* Month selector */}
          <div className="flex items-center justify-between rounded-lg border px-1 py-1">
            <button
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors active:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {customRange ? "Özel Aralık" : statsPeriod.label}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors active:bg-accent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setRangePickerOpen(true)}
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-colors active:bg-accent"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Aralık
              </button>
            </div>
          </div>

          {/* Revenue card */}
          <Card className="mt-3 border-0 bg-primary/5 shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {customRange ? "Seçili Dönem Cirosu" : `${statsPeriod.label} Cirosu`}
              </p>
              {statsLoading ? (
                <div className="mx-auto mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
              ) : (
                <p className="mt-1 text-2xl font-bold text-primary">
                  {formatTL(stats.totalRevenue)}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                İşlem Sayısı: {stats.saleCount} satış
              </p>
            </CardContent>
          </Card>

          {/* Breakdown */}
          {stats.breakdown.length > 0 && (
            <Card className="mt-3 border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Tahsilat Dağılımı
                </p>
                <div className="flex flex-col gap-3">
                  {stats.breakdown.map((b) => {
                    const pct =
                      stats.totalRevenue > 0
                        ? (b.total / stats.totalRevenue) * 100
                        : 0;
                    return (
                      <div key={b.type}>
                        <div className="flex items-center justify-between text-sm">
                          <span>
                            {SALE_TYPE_LABELS[b.type].emoji}{" "}
                            {SALE_TYPE_LABELS[b.type].label}
                          </span>
                          <span className="font-semibold">
                            {formatTL(b.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all ${
                              BREAKDOWN_COLORS[b.type] ?? "bg-gray-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ───── Son İşlemler ───── */}
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Son İşlemler</p>
            <Link
              href="/gecmis"
              className="flex items-center gap-1 text-xs font-medium text-primary"
            >
              Tümünü Gör
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentSales.length === 0 && !loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz satış yok
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {recentSales.map((sale) => (
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
      </div>

      {/* Receipt sheet */}
      <ReceiptSheet
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        saleId={receiptSaleId}
      />

      {/* Custom range picker sheet */}
      <Sheet open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Tarih Aralığı Seç</SheetTitle>
            <SheetDescription>Başlangıç ve bitiş tarihlerini girin</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pt-4">
            <div>
              <Label htmlFor="range-from">Başlangıç</Label>
              <Input
                id="range-from"
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="range-to">Bitiş</Label>
              <Input
                id="range-to"
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button onClick={applyCustomRange} className="h-11 font-semibold">
              Uygula
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Sub-components ───

function SummaryCard({
  icon,
  title,
  loading,
  primaryValue,
  secondaryValue,
  bgClass,
}: {
  icon: React.ReactNode;
  title: string;
  loading: boolean;
  primaryValue: string;
  secondaryValue: string;
  bgClass: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgClass}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <div className="mt-1 h-6 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight">
                {primaryValue}
              </span>
              <span className="text-sm text-muted-foreground">
                {secondaryValue}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
