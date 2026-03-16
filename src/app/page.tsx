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
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { formatTL, SALE_TYPE_LABELS, DEBT_PAYMENT_TYPE_LABELS } from "@/lib/cart";
import type { DebtPaymentType, SaleType } from "@/lib/types";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { PaymentReceiptSheet, type PaymentReceiptData } from "@/components/accounts/payment-receipt-sheet";
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
  totalReceivables: number;
}

type FeedEntry =
  | { kind: "sale"; id: string; type: SaleType; total_amount: number; created_at: string; customer_name: string | null }
  | { kind: "payment"; id: string; amount: number; created_at: string; customer_name: string | null; note: string | null; payment_type: DebtPaymentType | null; remaining_balance: number | null };

interface StatsData {
  totalRevenue: number;
  saleCount: number;
  breakdown: { type: SaleType; total: number }[];
  debtCollection: number;
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
    totalReceivables: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feed
  const [feed, setFeed] = useState<FeedEntry[]>([]);
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
    debtCollection: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // ─── Fetch dashboard cards + recent feed ───
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const supabase = getSupabase();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [salesRes, debtRes, emanetRes, recentSalesRes, recentPaymentsRes] =
          await Promise.all([
            supabase
              .from("sales")
              .select("total_amount")
              .gte("created_at", todayStart.toISOString())
              .neq("type", "emanet"),
            supabase.from("customers").select("id, total_debt").gt("total_debt", 0),
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
              .limit(10),
            supabase
              .from("debt_payments")
              .select("id, amount, created_at, customer_id, note, payment_type, remaining_balance")
              .order("created_at", { ascending: false })
              .limit(10),
          ]);

        const sales = salesRes.data ?? [];
        const totalAmount = sales.reduce(
          (sum, s) => sum + Number(s.total_amount),
          0
        );

        const debtCustomers = (debtRes.data ?? []) as { id: string; total_debt: number }[];
        const totalReceivables = debtCustomers.reduce(
          (sum, c) => sum + Number(c.total_debt),
          0
        );

        setData({
          todaySalesCount: sales.length,
          todaySalesTotal: totalAmount,
          activeDebtCount: debtCustomers.length,
          activeEmanetCount: emanetRes.data?.length ?? 0,
          totalReceivables,
        });

        // Gather all customer IDs from both sources
        const recentSales = (recentSalesRes.data ?? []) as {
          id: string;
          type: SaleType;
          total_amount: number;
          created_at: string;
          customer_id: string | null;
        }[];
        const recentPayments = (recentPaymentsRes.data ?? []) as {
          id: string;
          amount: number;
          created_at: string;
          customer_id: string;
          note: string | null;
          payment_type: DebtPaymentType | null;
          remaining_balance: number | null;
        }[];

        const allCustIds = Array.from(
          new Set([
            ...recentSales.map((r) => r.customer_id).filter(Boolean),
            ...recentPayments.map((r) => r.customer_id).filter(Boolean),
          ] as string[])
        );
        const nameMap: Record<string, string> = {};
        if (allCustIds.length > 0) {
          const { data: custs } = await supabase
            .from("customers")
            .select("id, name")
            .in("id", allCustIds);
          for (const c of custs ?? []) {
            const cust = c as { id: string; name: string };
            nameMap[cust.id] = cust.name;
          }
        }

        // Build unified feed
        const saleEntries: FeedEntry[] = recentSales.map((r) => ({
          kind: "sale",
          id: r.id,
          type: r.type,
          total_amount: r.total_amount,
          created_at: r.created_at,
          customer_name: r.customer_id ? nameMap[r.customer_id] ?? null : null,
        }));
        const paymentEntries: FeedEntry[] = recentPayments.map((r) => ({
          kind: "payment",
          id: r.id,
          amount: Number(r.amount),
          created_at: r.created_at,
          customer_name: r.customer_id ? nameMap[r.customer_id] ?? null : null,
          note: r.note,
          payment_type: r.payment_type,
          remaining_balance: r.remaining_balance != null ? Number(r.remaining_balance) : null,
        }));

        const merged = [...saleEntries, ...paymentEntries]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 5);

        setFeed(merged);
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
      const [salesResult, debtPayResult] = await Promise.all([
        supabase
          .from("sales")
          .select("type, total_amount")
          .eq("status", "completed")
          .gte("created_at", statsPeriod.from)
          .lte("created_at", statsPeriod.to)
          .gt("total_amount", 0),
        supabase
          .from("debt_payments")
          .select("amount")
          .gte("created_at", statsPeriod.from)
          .lte("created_at", statsPeriod.to),
      ]);

      if (salesResult.error) throw salesResult.error;

      const rows = (salesResult.data ?? []) as { type: SaleType; total_amount: number }[];
      const totalRevenue = rows.reduce((s, r) => s + Number(r.total_amount), 0);
      const typeMap: Partial<Record<SaleType, number>> = {};
      for (const r of rows) {
        typeMap[r.type] = (typeMap[r.type] ?? 0) + Number(r.total_amount);
      }
      const breakdown = Object.entries(typeMap)
        .map(([type, total]) => ({ type: type as SaleType, total: total as number }))
        .sort((a, b) => b.total - a.total);

      const debtCollection = (debtPayResult.data ?? []).reduce(
        (s, r) => s + Number((r as { amount: number }).amount),
        0
      );

      setStats({ totalRevenue, saleCount: rows.length, breakdown, debtCollection });
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

  const [payReceiptOpen, setPayReceiptOpen] = useState(false);
  const [payReceiptData, setPayReceiptData] = useState<PaymentReceiptData | null>(null);

  function openPaymentReceipt(entry: Extract<FeedEntry, { kind: "payment" }>) {
    setPayReceiptData({
      customerName: entry.customer_name ?? "Müşteri",
      customerPhone: null,
      date: new Date(entry.created_at),
      paymentType: entry.payment_type ?? "nakit",
      amount: entry.amount,
      remainingBalance: entry.remaining_balance,
      note: entry.note,
    });
    setPayReceiptOpen(true);
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
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={<CreditCard className="h-5 w-5 text-emerald-600" />}
            title="Bugünkü Satışlar"
            loading={loading && !error}
            primaryValue={formatTL(data.todaySalesTotal)}
            secondaryValue={`${data.todaySalesCount} adet`}
            bgClass="bg-emerald-50"
          />
          <SummaryCard
            icon={<Wallet className="h-5 w-5 text-red-600" />}
            title="Toplam Alacak"
            loading={loading && !error}
            primaryValue={formatTL(data.totalReceivables)}
            secondaryValue={`${data.activeDebtCount} müşteri`}
            bgClass="bg-red-50"
          />
          <SummaryCard
            icon={<BookOpen className="h-5 w-5 text-amber-600" />}
            title="Açık Hesaplar"
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

          <Card className="mt-3 border-0 bg-primary/5 shadow-none">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">
                {customRange
                  ? "Seçili Dönem Cirosu"
                  : `${statsPeriod.label} Cirosu`}
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

          {stats.breakdown.length > 0 && (
            <Card className="mt-3 border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">
                  Satış Dağılımı
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

                {stats.debtCollection > 0 && (
                  <>
                    <div className="my-3 border-t border-dashed" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        ✅ Cari Tahsilat
                      </span>
                      <span className="font-semibold text-emerald-600">
                        {formatTL(stats.debtCollection)}
                      </span>
                    </div>
                  </>
                )}
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

          {feed.length === 0 && !loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Henüz işlem yok
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {feed.map((entry) =>
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
                  <button
                    key={`p-${entry.id}`}
                    onClick={() => openPaymentReceipt(entry)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left transition-colors active:bg-accent"
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
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {formatTL(entry.amount)}
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <ReceiptSheet
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        saleId={receiptSaleId}
      />

      <PaymentReceiptSheet
        open={payReceiptOpen}
        onOpenChange={setPayReceiptOpen}
        data={payReceiptData}
      />

      <Sheet open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle>Tarih Aralığı Seç</SheetTitle>
            <SheetDescription>
              Başlangıç ve bitiş tarihlerini girin
            </SheetDescription>
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
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardContent className="flex items-center gap-3 p-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bgClass}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{title}</p>
          {loading ? (
            <div className="mt-1 h-5 w-20 animate-pulse rounded bg-muted" />
          ) : (
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight tracking-tight">
                {primaryValue}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {secondaryValue}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
