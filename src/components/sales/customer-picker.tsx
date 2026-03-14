"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL } from "@/lib/cart";
import type { Customer, SaleType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface CustomerPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleType: SaleType;
  onSelect: (customer: Customer) => void;
}

export function CustomerPicker({
  open,
  onOpenChange,
  saleType,
  onSelect,
}: CustomerPickerProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name");
      if (error) throw error;
      setCustomers((data ?? []) as Customer[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearch("");
      setShowCreate(false);
      setNewName("");
      setNewPhone("");
      setLoading(true);
      fetchCustomers();
    }
  }, [open, fetchCustomers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [customers, search]);

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Müşteri adı gerekli");
      return;
    }
    setCreating(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: newName.trim(),
          phone: newPhone.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Müşteri oluşturuldu");
      onSelect(data as Customer);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Müşteri oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  const typeLabel = saleType === "acik_hesap" ? "Açık Hesap" : "Emanet";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[80dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Müşteri Seçin</SheetTitle>
          <SheetDescription>
            {typeLabel} için müşteri seçin veya yeni ekleyin
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-3">
          {showCreate ? (
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="cust-name">Müşteri Adı *</Label>
                <Input
                  id="cust-name"
                  placeholder="Ad Soyad"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="cust-phone">Telefon</Label>
                <Input
                  id="cust-phone"
                  type="tel"
                  placeholder="05XX XXX XX XX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCreate(false)}
                >
                  İptal
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Kaydet
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-1">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelect(c);
                        onOpenChange(false);
                      }}
                      className="flex items-center justify-between rounded-lg px-3 py-3 text-left transition-colors active:bg-accent"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.phone && (
                          <p className="text-xs text-muted-foreground">
                            {c.phone}
                          </p>
                        )}
                      </div>
                      {saleType === "acik_hesap" && c.total_debt > 0 && (
                        <span className="text-xs font-medium text-amber-600">
                          Borç: {formatTL(c.total_debt)}
                        </span>
                      )}
                    </button>
                  ))}

                  {filtered.length === 0 && !loading && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {search ? "Müşteri bulunamadı" : "Henüz müşteri yok"}
                    </p>
                  )}
                </div>
              )}

              {/* Create button */}
              <button
                onClick={() => setShowCreate(true)}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-input px-3 py-3 text-sm font-medium text-muted-foreground transition-colors active:border-primary active:text-primary"
              >
                <UserPlus className="h-4 w-4" />
                Yeni Müşteri Ekle
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
