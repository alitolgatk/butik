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
import type { PaymentReceiptData } from "./payment-receipt-sheet";

const PAYMENT_TYPES: DebtPaymentType[] = ["nakit", "kart", "havale"];

interface PaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  onPaid: (receipt: PaymentReceiptData) => void;
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
  const [discountMode, setDiscountMode] = useState<"tl" | "percent">("tl");
  const [discountValue, setDiscountValue] = useState("");

  const discountAmount = (() => {
    const v = parseFloat(discountValue);
    if (isNaN(v) || v <= 0) return 0;
    if (discountMode === "percent") {
      return Math.min(customer.total_debt, (customer.total_debt * v) / 100);
    }
    return Math.min(customer.total_debt, v);
  })();

  const effectiveDebt = Math.max(0, customer.total_debt - discountAmount);

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setPaymentType("nakit");
      setAmount(customer.total_debt > 0 ? String(customer.total_debt) : "");
      setNote("");
      setDiscountMode("tl");
      setDiscountValue("");
    }
    onOpenChange(isOpen);
  }

  async function handleSave() {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 0) {
      toast.error("Geçerli bir tutar girin");
      return;
    }
    if (num > effectiveDebt) {
      toast.error("Tutar indirimli borçtan fazla olamaz");
      return;
    }
    if (num === 0 && discountAmount === 0) {
      toast.error("Tutar ya da indirim girilmeli");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();
      const newBalance = Math.max(0, customer.total_debt - discountAmount - num);

      const noteText = [
        note.trim(),
        discountAmount > 0
          ? `İndirim: ${formatTL(discountAmount)}${discountMode === "percent" ? ` (%${discountValue})` : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      if (num > 0) {
        const { error: payErr } = await supabase
          .from("debt_payments")
          .insert({
            customer_id: customer.id,
            amount: num,
            payment_type: paymentType,
            note: noteText || null,
            remaining_balance: newBalance,
          });
        if (payErr) throw payErr;
      }

      const { error: custErr } = await supabase
        .from("customers")
        .update({ total_debt: newBalance })
        .eq("id", customer.id);
      if (custErr) throw custErr;

      const msg =
        discountAmount > 0 && num === 0
          ? `${formatTL(discountAmount)} indirim uygulandı ✓`
          : discountAmount > 0
            ? `Ödeme kaydedildi (${formatTL(discountAmount)} indirim) ✓`
            : "Ödeme kaydedildi ✓";

      toast.success(msg);
      onOpenChange(false);
      onPaid({
        customerName: customer.name,
        customerPhone: customer.phone,
        date: new Date(),
        paymentType,
        amount: num,
        remainingBalance: newBalance,
        note: noteText || null,
      });
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

          {/* Discount */}
          <div>
            <Label>İndirim (isteğe bağlı)</Label>
            <div className="mt-1.5 flex gap-2">
              <div className="flex rounded-lg border overflow-hidden text-sm">
                <button
                  onClick={() => { setDiscountMode("tl"); setDiscountValue(""); }}
                  className={`px-3 py-2 font-medium transition-colors ${discountMode === "tl" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                >
                  ₺
                </button>
                <button
                  onClick={() => { setDiscountMode("percent"); setDiscountValue(""); }}
                  className={`px-3 py-2 font-medium transition-colors ${discountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                >
                  %
                </button>
              </div>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {discountMode === "tl" ? "₺" : "%"}
                </span>
                <Input
                  type="number"
                  min="0"
                  max={discountMode === "percent" ? 100 : customer.total_debt}
                  step="0.01"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => {
                    setDiscountValue(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) {
                      const disc =
                        discountMode === "percent"
                          ? Math.min(customer.total_debt, (customer.total_debt * v) / 100)
                          : Math.min(customer.total_debt, v);
                      setAmount(String(Math.max(0, customer.total_debt - disc)));
                    } else {
                      setAmount(String(customer.total_debt));
                    }
                  }}
                  className="pl-7"
                />
              </div>
            </div>
            {discountAmount > 0 && (
              <p className="mt-1.5 text-xs text-green-700 font-medium">
                İndirim: {formatTL(discountAmount)} → İndirimli borç:{" "}
                <span className="font-bold">{formatTL(effectiveDebt)}</span>
              </p>
            )}
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
                max={effectiveDebt}
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
