"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import type { ProductVariant } from "@/lib/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ─── Size sort ───

const SIZE_ORDER = [
  "STD", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "34", "36", "38", "40", "42", "44", "46", "48", "50",
];

function sizeOrderIndex(label: string): number {
  if (!label) return 99999;
  const trimmed = label.trim();
  const idx = SIZE_ORDER.indexOf(trimmed);
  if (idx !== -1) return idx;
  const upper = trimmed.toUpperCase();
  const idxU = SIZE_ORDER.indexOf(upper);
  if (idxU !== -1) return idxU;
  const num = parseInt(trimmed);
  if (!isNaN(num)) {
    for (let i = 0; i < SIZE_ORDER.length; i++) {
      const n = parseInt(SIZE_ORDER[i]);
      if (!isNaN(n) && num < n) return i - 0.5;
    }
    return SIZE_ORDER.length;
  }
  return SIZE_ORDER.length + 1000;
}

function sortVariantsBySize(items: ProductVariant[]): ProductVariant[] {
  return [...items].sort((a, b) => {
    const diff =
      sizeOrderIndex(a.size_label) - sizeOrderIndex(b.size_label);
    if (diff !== 0) return diff;
    return (a.size_label ?? "").localeCompare(b.size_label ?? "", "tr");
  });
}

// ─── Component ───

interface VariantPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  variants: ProductVariant[];
  onSelect: (variant: ProductVariant) => void;
}

export function VariantPicker({
  open,
  onOpenChange,
  productName,
  variants,
  onSelect,
}: VariantPickerProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const hasColors = useMemo(
    () => variants.some((v) => v.color_label),
    [variants]
  );

  const uniqueColors = useMemo(() => {
    if (!hasColors) return [];
    const map = new Map<string, { totalStock: number }>();
    for (const v of variants) {
      const color = v.color_label ?? "";
      if (!color) continue;
      const existing = map.get(color);
      map.set(color, { totalStock: (existing?.totalStock ?? 0) + v.stock });
    }
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      totalStock: data.totalStock,
    }));
  }, [variants, hasColors]);

  const sizesForColor = useMemo(() => {
    if (selectedColor === null) return [];
    return sortVariantsBySize(
      variants.filter((v) => v.color_label === selectedColor)
    );
  }, [variants, selectedColor]);

  const sizeOnlyVariants = useMemo(() => {
    if (hasColors) return [];
    return sortVariantsBySize(variants);
  }, [variants, hasColors]);

  function handleColorTap(colorName: string) {
    const colorVariants = variants.filter(
      (v) => v.color_label === colorName
    );
    const hasSizes = colorVariants.some((v) => v.size_label);

    if (!hasSizes && colorVariants.length === 1) {
      if (colorVariants[0].stock <= 0) {
        toast.warning(`${colorName} stoku tükenmiş, yine de eklendi`);
      }
      onSelect(colorVariants[0]);
      onOpenChange(false);
      return;
    }

    setSelectedColor(colorName);
  }

  function handleSizeTap(variant: ProductVariant) {
    onSelect(variant);
    onOpenChange(false);
  }

  function handleBack() {
    setSelectedColor(null);
  }

  function handleSheetChange(isOpen: boolean) {
    if (!isOpen) setSelectedColor(null);
    onOpenChange(isOpen);
  }

  const showColorStep = hasColors && selectedColor === null;
  const showSizeStep = hasColors && selectedColor !== null;
  const showSizeOnly = !hasColors;

  return (
    <Sheet open={open} onOpenChange={handleSheetChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="px-4 pt-4">
          {showColorStep && (
            <>
              <SheetTitle>Renk Seçin</SheetTitle>
              <SheetDescription>{productName}</SheetDescription>
            </>
          )}
          {showSizeStep && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors active:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <SheetTitle className="flex-1">Beden Seçin</SheetTitle>
              </div>
              <SheetDescription>
                {productName} — {selectedColor}
              </SheetDescription>
            </>
          )}
          {showSizeOnly && (
            <>
              <SheetTitle>Beden Seçin</SheetTitle>
              <SheetDescription>{productName}</SheetDescription>
            </>
          )}
        </SheetHeader>

        {/* ── Step 1: Color grid ── */}
        {showColorStep && (
          <div className="mt-4 grid grid-cols-3 gap-2 px-4">
            {uniqueColors.map((c) => {
              const inStock = c.totalStock > 0;
              return (
                <button
                  key={c.name}
                  onClick={() => handleColorTap(c.name)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors active:border-primary active:bg-primary/5 ${
                    inStock
                      ? "border-input bg-background"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <span
                    className={`text-base ${!inStock ? "text-amber-800" : ""}`}
                  >
                    {c.name}
                  </span>
                  <span
                    className={`text-xs ${
                      inStock
                        ? "text-muted-foreground"
                        : "font-semibold text-amber-600"
                    }`}
                  >
                    {inStock ? `${c.totalStock} adet` : "Stok yok"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Step 2: Size grid for selected color (sorted) ── */}
        {showSizeStep && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 px-4">
              {sizesForColor.map((v) => {
                const inStock = v.stock > 0;
                const label = v.size_label || selectedColor || "—";
                return (
                  <button
                    key={v.id}
                    onClick={() => handleSizeTap(v)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors active:border-primary active:bg-primary/5 ${
                      inStock
                        ? "border-input bg-background"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <span
                      className={`text-base ${
                        !inStock ? "text-amber-800" : ""
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`text-xs ${
                        inStock
                          ? "text-muted-foreground"
                          : "font-semibold text-amber-600"
                      }`}
                    >
                      {inStock ? `${v.stock} adet` : "Stok yok"}
                    </span>
                  </button>
                );
              })}
            </div>

            {sizesForColor.every((v) => v.stock <= 0) && (
              <p className="px-4 pt-2 text-center text-xs text-amber-600">
                ⚠️ Bu renkte tüm bedenler tükenmiş, yine de ekleyebilirsiniz
              </p>
            )}
          </>
        )}

        {/* ── Size-only (no colors, sorted) ── */}
        {showSizeOnly && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 px-4">
              {sizeOnlyVariants.map((v) => {
                const inStock = v.stock > 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => handleSizeTap(v)}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors active:border-primary active:bg-primary/5 ${
                      inStock
                        ? "border-input bg-background"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <span
                      className={`text-base ${
                        !inStock ? "text-amber-800" : ""
                      }`}
                    >
                      {v.size_label || "—"}
                    </span>
                    <span
                      className={`text-xs ${
                        inStock
                          ? "text-muted-foreground"
                          : "font-semibold text-amber-600"
                      }`}
                    >
                      {inStock ? `${v.stock} adet` : "Stok yok"}
                    </span>
                  </button>
                );
              })}
            </div>

            {sizeOnlyVariants.every((v) => v.stock <= 0) && (
              <p className="px-4 pt-2 text-center text-xs text-amber-600">
                ⚠️ Tüm bedenler tükenmiş, yine de ekleyebilirsiniz
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
