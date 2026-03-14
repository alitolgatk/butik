"use client";

import type { SaleType } from "@/lib/types";
import { SALE_TYPE_LABELS } from "@/lib/cart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface PaymentTypePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: SaleType) => void;
}

const TYPE_ORDER: SaleType[] = ["nakit", "kart", "havale", "acik_hesap", "emanet"];

export function PaymentTypePicker({
  open,
  onOpenChange,
  onSelect,
}: PaymentTypePickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Ödeme Tipi</SheetTitle>
          <SheetDescription>Nasıl ödeme yapılacak?</SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          {TYPE_ORDER.map((type) => {
            const info = SALE_TYPE_LABELS[type];
            return (
              <button
                key={type}
                onClick={() => {
                  onSelect(type);
                  onOpenChange(false);
                }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-input bg-background px-4 py-5 transition-colors active:border-primary active:bg-primary/5"
              >
                <span className="text-2xl">{info.emoji}</span>
                <span className="text-sm font-semibold">{info.label}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
