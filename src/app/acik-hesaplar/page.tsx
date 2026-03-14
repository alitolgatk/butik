"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Users } from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import { formatTL } from "@/lib/cart";
import type { Customer } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { CustomerDetail } from "@/components/accounts/customer-detail";
import { NewCustomerSheet } from "@/components/accounts/new-customer-sheet";

export default function AcikHesaplarPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [newOpen, setNewOpen] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("total_debt", { ascending: false });
      if (error) throw error;
      setCustomers((data ?? []) as Customer[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, search]);

  function openDetail(id: string) {
    setSelectedCustomerId(id);
    setDetailOpen(true);
  }

  function handleUpdated() {
    fetchCustomers();
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-xl font-bold tracking-tight">Açık Hesaplar</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Müşteri ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-5">
              <Users className="h-10 w-10 text-muted-foreground" />
            </div>
            {search ? (
              <>
                <p className="font-medium">Sonuç bulunamadı</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  &ldquo;{search}&rdquo; ile eşleşen müşteri yok
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Henüz müşteri eklenmedi</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sağ alttaki + butonuna basarak müşteri ekleyin
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-4">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openDetail(c.id)}
                className="flex items-center justify-between rounded-lg px-3 py-3 text-left transition-colors active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.phone && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.phone}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    c.total_debt > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {c.total_debt > 0
                    ? `${formatTL(c.total_debt)} borç`
                    : "Borç yok"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setNewOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Customer detail sheet */}
      <CustomerDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        customerId={selectedCustomerId}
        onUpdated={handleUpdated}
      />

      {/* New customer sheet */}
      <NewCustomerSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={handleUpdated}
      />
    </>
  );
}
