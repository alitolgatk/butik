"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import { formatTL, DEBT_PAYMENT_TYPE_LABELS } from "@/lib/cart";
import type { Customer, DebtPaymentType } from "@/lib/types";
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

const PAYMENT_TYPES: DebtPaymentType[] = ["nakit", "kart", "havale"];

interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onPaid: () => void;
}

export function PaymentSheet({
  open,
  onOpenChange,
  customer,
  onPaid,
}: PaymentSheetProps) {
  const [paymentType, setPaymentType] = useState<DebtPaymentType>("nakit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setPaymentType("nakit");
      setAmount("");
      setNote("");
    }
    onOpenChange(isOpen);
  }

  async function handleSave() {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }
    if (num > customer.total_debt) {
      toast.error("Tutar borçtan fazla olamaz");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();

      const { error: payErr } = await supabase
        .from("debt_payments")
        .insert({
          customer_id: customer.id,
          amount: num,
          payment_type: paymentType,
          note: note.trim() || null,
        });
      if (payErr) throw payErr;

      const { error: custErr } = await supabase
        .from("customers")
        .update({ total_debt: Math.max(0, customer.total_debt - num) })
        .eq("id", customer.id);
      if (custErr) throw custErr;

      toast.success("Ödeme kaydedildi ✓");
      onPaid();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ödeme kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Ödeme Al</SheetTitle>
          <SheetDescription>{customer.name}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pt-4">
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-center">
            <p className="text-xs text-amber-700">Mevcut borç</p>
            <p className="text-lg font-bold text-amber-800">
              {formatTL(customer.total_debt)}
            </p>
          </div>

          {/* Payment type tiles */}
          <div>
            <Label>Ödeme Tipi</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PAYMENT_TYPES.map((pt) => {
                const info = DEBT_PAYMENT_TYPE_LABELS[pt];
                const selected = paymentType === pt;
                return (
                  <button
                    key={pt}
                    onClick={() => setPaymentType(pt)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-input bg-background active:bg-accent"
                    }`}
                  >
                    <span className="text-xl">{info.emoji}</span>
                    <span
                      className={`text-xs font-medium ${
                        selected ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {info.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="pay-amount">Tutar *</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₺
              </span>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                max={customer.total_debt}
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pay-note">Not</Label>
            <Input
              id="pay-note"
              placeholder="Ödeme notu..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-11 w-full font-semibold"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ödemeyi Kaydet
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
