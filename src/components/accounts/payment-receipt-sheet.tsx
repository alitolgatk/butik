"use client";

import { Share2, X } from "lucide-react";
import { toast } from "sonner";

import { formatTL, DEBT_PAYMENT_TYPE_LABELS } from "@/lib/cart";
import type { DebtPaymentType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export interface PaymentReceiptData {
  customerName: string;
  customerPhone: string | null;
  date: Date;
  paymentType: DebtPaymentType;
  amount: number;
  remainingBalance: number | null;
  note: string | null;
}

interface PaymentReceiptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PaymentReceiptData | null;
}

function formatDateFull(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function buildPlainText(data: PaymentReceiptData): string {
  const typeInfo = DEBT_PAYMENT_TYPE_LABELS[data.paymentType];
  const lines: string[] = [
    "Başak Butik",
    "Güzelyalı Mah. 81056 sok. no:11/c Çukurova ADANA",
    "",
    "TAHSİLAT MAKBUZU",
    "",
    `Müşteri: ${data.customerName}`,
  ];
  if (data.customerPhone) {
    lines.push(`Tel: ${data.customerPhone}`);
  }
  lines.push(`Tarih: ${formatDateFull(data.date)}`);
  lines.push("─────────────────────────");
  lines.push(`Ödeme Tipi: ${typeInfo.emoji} ${typeInfo.label}`);
  lines.push(`Tutar: ${formatTL(data.amount)}`);
  lines.push("─────────────────────────");
  if (data.remainingBalance !== null) {
    lines.push(`Kalan Borç: ${formatTL(data.remainingBalance)}`);
    lines.push("─────────────────────────");
  }
  if (data.note) {
    lines.push(`Not: ${data.note}`);
    lines.push("─────────────────────────");
  }
  lines.push("");
  lines.push("Teşekkürler");
  return lines.join("\n");
}

export function PaymentReceiptSheet({
  open,
  onOpenChange,
  data,
}: PaymentReceiptSheetProps) {
  if (!data) return null;

  const typeInfo = DEBT_PAYMENT_TYPE_LABELS[data.paymentType];

  async function handleShare() {
    if (!data) return;
    const text = buildPlainText(data);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Başak Butik - Tahsilat Makbuzu",
          text,
        });
      } catch {
        // user cancelled
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast.success("Panoya kopyalandı");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[80dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Tahsilat Makbuzu</SheetTitle>
          <SheetDescription className="sr-only">
            Ödeme makbuzu detayları
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-3">
          <div className="mx-auto max-w-sm rounded-xl border bg-card p-5">
            {/* Business header */}
            <div className="text-center">
              <p className="text-base font-bold">Başak Butik</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Güzelyalı Mah. 81056 sok. no:11/c
              </p>
              <p className="text-xs text-muted-foreground">
                Çukurova ADANA
              </p>
            </div>

            <div className="my-3 border-b border-dashed" />

            <p className="text-center text-sm font-semibold tracking-wide">
              TAHSİLAT MAKBUZU
            </p>

            <div className="my-3 border-b border-dashed" />

            {/* Customer & date info */}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Müşteri</span>
                <span className="font-medium">{data.customerName}</span>
              </div>
              {data.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tel</span>
                  <span className="font-medium">{data.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tarih</span>
                <span className="font-medium">
                  {formatDateFull(data.date)}
                </span>
              </div>
            </div>

            <div className="my-3 border-b border-dashed" />

            {/* Payment info */}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ödeme Tipi</span>
                <span className="font-medium">
                  {typeInfo.emoji} {typeInfo.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tutar</span>
                <span className="text-lg font-bold text-emerald-600">
                  {formatTL(data.amount)}
                </span>
              </div>
            </div>

            {data.remainingBalance !== null && (
              <>
                <div className="my-3 border-b border-dashed" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kalan Borç</span>
                  <span
                    className={`font-semibold ${
                      data.remainingBalance > 0
                        ? "text-red-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {formatTL(data.remainingBalance)}
                  </span>
                </div>
              </>
            )}

            {data.note && (
              <>
                <div className="my-3 border-b border-dashed" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Not</span>
                  <span className="font-medium">{data.note}</span>
                </div>
              </>
            )}

            <div className="my-3 border-b border-dashed" />

            <p className="text-center text-sm text-muted-foreground">
              Teşekkürler
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 border-t bg-background px-4 py-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 gap-2"
          >
            <X className="h-4 w-4" />
            Kapat
          </Button>
          <Button onClick={handleShare} className="flex-1 gap-2">
            <Share2 className="h-4 w-4" />
            Paylaş
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
