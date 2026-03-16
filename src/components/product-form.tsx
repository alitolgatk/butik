"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Camera, ChevronDown, ChevronRight, Loader2, Palette, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import type { Product, ProductVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Constants ───

const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: "Siyah", hex: "#000000" },
  { name: "Beyaz", hex: "#FFFFFF" },
  { name: "Kırmızı", hex: "#EF4444" },
  { name: "Lacivert", hex: "#1E3A5F" },
  { name: "Mavi", hex: "#3B82F6" },
  { name: "Yeşil", hex: "#22C55E" },
  { name: "Sarı", hex: "#EAB308" },
  { name: "Turuncu", hex: "#F97316" },
  { name: "Pembe", hex: "#EC4899" },
  { name: "Kahverengi", hex: "#92400E" },
  { name: "Gri", hex: "#6B7280" },
];

const SIZE_CHIPS = ["STD", "XS", "S", "M", "L", "XL", "XXL", "34", "36", "38", "40", "42", "44", "46"];

const SIZE_ORDER = [
  "STD", "XS", "S", "M", "L", "XL", "XXL", "XXXL",
  "34", "36", "38", "40", "42", "44", "46", "48", "50",
];

// ─── Size sort ───

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

function sortedSizeIndices(sizes: SizeRow[]): number[] {
  return sizes
    .map((_, i) => i)
    .sort((a, b) => {
      const diff = sizeOrderIndex(sizes[a].size_label) - sizeOrderIndex(sizes[b].size_label);
      if (diff !== 0) return diff;
      return sizes[a].size_label.localeCompare(sizes[b].size_label, "tr");
    });
}

function getPresetHex(colorName: string): string | null {
  return (
    PRESET_COLORS.find(
      (c) => c.name.toLowerCase() === colorName.trim().toLowerCase()
    )?.hex ?? null
  );
}

// ─── Types ───

interface SizeRow {
  id?: string;
  size_label: string;
  stock: number;
  isCustom?: boolean;
}

interface ColorGroup {
  colorName: string; // "" = backward-compat no-color group
  expanded: boolean;
  sizes: SizeRow[];
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { variants?: ProductVariant[] }) | null;
  onSaved: () => void;
}

// ─── Component ───

export function ProductForm({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductFormProps) {
  const isEditing = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [hasVariants, setHasVariants] = useState(false);
  const [stock, setStock] = useState("0");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [colorGroups, setColorGroups] = useState<ColorGroup[]>([]);
  const [showCustomColorInput, setShowCustomColorInput] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("");

  // ── Init on open ──

  useEffect(() => {
    if (open) {
      if (product) {
        setName(product.name);
        setPrice(String(product.price));
        setHasVariants(product.has_variants);
        setStock(String(product.stock));
        setPhotoPreview(product.photo_url);
        setPhotoFile(null);

        const vs = product.variants ?? [];
        if (vs.length === 0) {
          setColorGroups([]);
        } else {
          const grouped: Record<string, SizeRow[]> = {};
          for (const v of vs) {
            const color = v.color_label ?? "";
            if (!grouped[color]) grouped[color] = [];
            grouped[color].push({
              id: v.id,
              size_label: v.size_label ?? "",
              stock: v.stock,
              isCustom: !SIZE_CHIPS.includes(v.size_label ?? ""),
            });
          }
          setColorGroups(
            Object.entries(grouped).map(([colorName, sizes]) => ({
              colorName,
              expanded: true,
              sizes,
            }))
          );
        }
      } else {
        setName("");
        setPrice("");
        setHasVariants(false);
        setStock("0");
        setPhotoPreview(null);
        setPhotoFile(null);
        setColorGroups([]);
      }
      setShowCustomColorInput(false);
      setCustomColorInput("");
    }
  }, [open, product]);

  // ── Photo ──

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // ── Color helpers ──

  function isColorSelected(colorName: string): boolean {
    return colorGroups.some(
      (g) => g.colorName.toLowerCase() === colorName.toLowerCase()
    );
  }

  function toggleColor(colorName: string) {
    setColorGroups((prev) => {
      const existing = prev.find(
        (g) => g.colorName.toLowerCase() === colorName.toLowerCase()
      );
      if (existing) {
        return prev.filter((g) => g !== existing);
      }

      // If there's a no-color backward-compat group, transfer its sizes
      const noColorGroup = prev.find((g) => g.colorName === "");
      const rest = prev.filter((g) => g.colorName !== "");

      const transferred = noColorGroup?.sizes ?? [];
      return [
        ...rest,
        {
          colorName,
          expanded: true,
          sizes: transferred.map((s) => ({ ...s })),
        },
      ];
    });
  }

  function addCustomColor() {
    const trimmed = customColorInput.trim();
    if (!trimmed) return;
    if (isColorSelected(trimmed)) {
      toast.error("Bu renk zaten ekli");
      return;
    }

    setColorGroups((prev) => {
      const noColorGroup = prev.find((g) => g.colorName === "");
      const rest = prev.filter((g) => g.colorName !== "");
      const transferred = noColorGroup?.sizes ?? [];
      return [
        ...rest,
        {
          colorName: trimmed,
          expanded: true,
          sizes: transferred.map((s) => ({ ...s })),
        },
      ];
    });
    setCustomColorInput("");
    setShowCustomColorInput(false);
  }

  function removeColorGroup(ci: number) {
    setColorGroups((prev) => prev.filter((_, i) => i !== ci));
  }

  function toggleColorExpand(ci: number) {
    setColorGroups((prev) =>
      prev.map((g, i) => (i === ci ? { ...g, expanded: !g.expanded } : g))
    );
  }

  // ── Size helpers ──

  function addSizeToColor(ci: number, label: string, isCustom: boolean) {
    setColorGroups((prev) =>
      prev.map((g, i) => {
        if (i !== ci) return g;
        if (label && g.sizes.some((s) => s.size_label === label)) return g;
        return {
          ...g,
          sizes: [...g.sizes, { size_label: label, stock: 0, isCustom }],
        };
      })
    );
  }

  function removeSizeFromColor(ci: number, si: number) {
    setColorGroups((prev) =>
      prev.map((g, i) =>
        i === ci ? { ...g, sizes: g.sizes.filter((_, j) => j !== si) } : g
      )
    );
  }

  function updateSizeInColor(
    ci: number,
    si: number,
    field: "size_label" | "stock",
    value: string | number
  ) {
    setColorGroups((prev) =>
      prev.map((g, i) =>
        i === ci
          ? {
              ...g,
              sizes: g.sizes.map((s, j) =>
                j === si ? { ...s, [field]: value } : s
              ),
            }
          : g
      )
    );
  }

  // ── Flatten for save ──

  function getAllVariantRows(): {
    id?: string;
    size_label: string;
    color_label: string | null;
    stock: number;
  }[] {
    const rows: {
      id?: string;
      size_label: string;
      color_label: string | null;
      stock: number;
    }[] = [];
    for (const group of colorGroups) {
      const color = group.colorName.trim() || null;
      for (const s of group.sizes) {
        rows.push({
          id: s.id,
          size_label: s.size_label,
          color_label: color,
          stock: Number(s.stock),
        });
      }
    }
    return rows;
  }

  function totalSizeCount(): number {
    return colorGroups.reduce((sum, g) => sum + g.sizes.length, 0);
  }

  // ── Upload ──

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return product?.photo_url ?? null;
    const supabase = getSupabase();
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("product-photos")
      .upload(fileName, photoFile, { cacheControl: "3600", upsert: false });
    if (error) throw new Error("Fotoğraf yüklenemedi: " + error.message);
    const { data } = supabase.storage
      .from("product-photos")
      .getPublicUrl(fileName);
    return data.publicUrl;
  }

  // ── Save ──

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Ürün adı gerekli");
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Geçerli bir fiyat girin");
      return;
    }
    if (hasVariants && totalSizeCount() === 0) {
      toast.error("En az bir renk ve beden ekleyin");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();
      const photoUrl = await uploadPhoto();
      const allRows = hasVariants ? getAllVariantRows() : [];
      const totalStock = hasVariants
        ? allRows.reduce((s, v) => s + v.stock, 0)
        : Number(stock);

      const productData = {
        name: name.trim(),
        price: priceNum,
        photo_url: photoUrl,
        has_variants: hasVariants,
        stock: totalStock,
      };

      let productId = product?.id;

      if (isEditing && productId) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }

      if (hasVariants) {
        if (isEditing) {
          const { data: dbVars } = await supabase
            .from("product_variants")
            .select("id")
            .eq("product_id", productId!);
          const dbIdSet = new Set(
            (dbVars ?? []).map((v: { id: string }) => v.id)
          );

          const existingRows = allRows.filter(
            (v) => v.id && dbIdSet.has(v.id)
          );
          const newRows = allRows.filter(
            (v) => !v.id || !dbIdSet.has(v.id)
          );

          const formIdSet = new Set(existingRows.map((v) => v.id!));
          const toDeleteIds = Array.from(dbIdSet).filter(
            (id) => !formIdSet.has(id)
          );
          if (toDeleteIds.length > 0) {
            await supabase
              .from("product_variants")
              .delete()
              .in("id", toDeleteIds);
          }

          if (existingRows.length > 0) {
            const upsertData = existingRows.map((v) => ({
              id: v.id!,
              product_id: productId!,
              size_label: v.size_label,
              color_label: v.color_label || null,
              stock: v.stock,
            }));
            const { error: uErr } = await supabase
              .from("product_variants")
              .upsert(upsertData, { onConflict: "id" });
            if (uErr) throw uErr;
          }

          if (newRows.length > 0) {
            const insertData = newRows.map((v) => ({
              product_id: productId!,
              size_label: v.size_label,
              color_label: v.color_label || null,
              stock: v.stock,
            }));
            const { error: iErr } = await supabase
              .from("product_variants")
              .insert(insertData);
            if (iErr) throw iErr;
          }
        } else {
          if (allRows.length > 0) {
            const insertData = allRows.map((v) => ({
              product_id: productId!,
              size_label: v.size_label,
              color_label: v.color_label || null,
              stock: v.stock,
            }));
            const { error: iErr } = await supabase
              .from("product_variants")
              .insert(insertData);
            if (iErr) throw iErr;
          }
        }
      } else {
        if (isEditing) {
          await supabase
            .from("product_variants")
            .delete()
            .eq("product_id", productId!);
        }
      }

      toast.success(isEditing ? "Ürün güncellendi" : "Ürün eklendi");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      const supabase = getSupabase();
      if (product.photo_url) {
        const parts = product.photo_url.split("product-photos/");
        const fileName = parts[1];
        if (fileName) {
          const { error: storageErr } = await supabase.storage
            .from("product-photos")
            .remove([fileName]);
          if (storageErr) console.error("Fotoğraf silinemedi:", storageErr);
        }
      }
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);
      if (error) throw error;
      toast.success("Ürün silindi");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Silme başarısız");
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived: custom colors not in presets ──

  const customColorNames = colorGroups
    .map((g) => g.colorName)
    .filter(
      (n) =>
        n !== "" &&
        !PRESET_COLORS.some(
          (p) => p.name.toLowerCase() === n.toLowerCase()
        )
    );

  // ── Render ──

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] flex-col rounded-t-2xl"
      >
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>
            {isEditing ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isEditing
              ? "Ürün bilgilerini düzenleyin"
              : "Yeni ürün bilgilerini girin"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex flex-col gap-5 pt-2">
            {/* Photo */}
            <div>
              <Label className="mb-2 block">Fotoğraf</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-input bg-muted/50 transition-colors hover:bg-muted"
              >
                {photoPreview ? (
                  <Image
                    src={photoPreview}
                    alt="Ürün fotoğrafı"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <span className="text-xs">Fotoğraf Ekle</span>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />
              {photoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 text-xs text-muted-foreground"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                >
                  <X className="mr-1 h-3 w-3" />
                  Fotoğrafı Kaldır
                </Button>
              )}
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="product-name">Ürün Adı *</Label>
              <Input
                id="product-name"
                placeholder="Örn: Siyah Elbise"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Price */}
            <div>
              <Label htmlFor="product-price">Fiyat *</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            {/* Variant Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="has-variants" className="cursor-pointer">
                Bu ürünün renk ve beden seçenekleri var
              </Label>
              <Switch
                id="has-variants"
                checked={hasVariants}
                onCheckedChange={setHasVariants}
              />
            </div>

            {/* Stock (no variants) */}
            {!hasVariants && (
              <div>
                <Label htmlFor="product-stock">Stok Adedi</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            )}

            {/* ── Variant section ── */}
            {hasVariants && (
              <div className="flex flex-col gap-4">
                {/* Step A — Color Selection */}
                <div>
                  <Label className="mb-2 block">Renkler</Label>

                  {/* Preset color chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((pc) => {
                      const selected = isColorSelected(pc.name);
                      return (
                        <button
                          key={pc.name}
                          type="button"
                          onClick={() => toggleColor(pc.name)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-input bg-background text-foreground hover:bg-accent"
                          }`}
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-black/15"
                            style={{ backgroundColor: pc.hex }}
                          />
                          {pc.name}
                        </button>
                      );
                    })}

                    {/* Custom color chips (from DB, not in presets) */}
                    {customColorNames.map((cn) => (
                      <button
                        key={cn}
                        type="button"
                        onClick={() => toggleColor(cn)}
                        className="flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors"
                      >
                        <Palette className="h-3 w-3 shrink-0" />
                        {cn}
                      </button>
                    ))}
                  </div>

                  {/* Add custom color */}
                  <div className="mt-2">
                    {!showCustomColorInput ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCustomColorInput(true)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Özel Renk Ekle
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Renk adı yazın..."
                          value={customColorInput}
                          onChange={(e) => setCustomColorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomColor();
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={addCustomColor}
                          disabled={!customColorInput.trim()}
                        >
                          Ekle
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          onClick={() => {
                            setShowCustomColorInput(false);
                            setCustomColorInput("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step B — Sizes per Color */}
                {colorGroups.map((group, ci) => {
                  const isNoColor = group.colorName === "";
                  const hex = getPresetHex(group.colorName);
                  const totalStock = group.sizes.reduce(
                    (s, r) => s + Number(r.stock),
                    0
                  );
                  const sorted = sortedSizeIndices(group.sizes);

                  return (
                    <div
                      key={`${group.colorName}-${ci}`}
                      className="overflow-hidden rounded-lg border"
                    >
                      {/* Color header (skip for no-color group) */}
                      {!isNoColor ? (
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleColorExpand(ci)}
                            className="shrink-0 text-muted-foreground"
                          >
                            {group.expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          {hex ? (
                            <span
                              className="h-4 w-4 shrink-0 rounded-full border border-black/15"
                              style={{ backgroundColor: hex }}
                            />
                          ) : (
                            <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1 text-sm font-semibold">
                            {group.colorName}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {totalStock} stok
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeColorGroup(ci)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-muted/50 px-3 py-2">
                          <span className="text-sm font-semibold">Bedenler</span>
                          <span className="text-xs text-muted-foreground">
                            {totalStock} stok
                          </span>
                        </div>
                      )}

                      {/* Expanded content */}
                      {(isNoColor || group.expanded) && (
                        <div className="flex flex-col gap-2.5 p-3">
                          {/* Size chips */}
                          <div className="flex flex-wrap gap-1">
                            {SIZE_CHIPS.map((size) => {
                              const exists = group.sizes.some(
                                (s) => s.size_label === size
                              );
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() =>
                                    addSizeToColor(ci, size, false)
                                  }
                                  disabled={exists}
                                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                    exists
                                      ? "border-primary/30 bg-primary/10 text-primary"
                                      : "border-input bg-background text-foreground hover:bg-accent"
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>

                          {/* Size rows (sorted) */}
                          {sorted.map((origIdx) => {
                            const sizeRow = group.sizes[origIdx];
                            return (
                              <div
                                key={origIdx}
                                className="flex items-center gap-2"
                              >
                                {sizeRow.isCustom ? (
                                  <Input
                                    placeholder="Beden adı"
                                    value={sizeRow.size_label}
                                    onChange={(e) =>
                                      updateSizeInColor(
                                        ci,
                                        origIdx,
                                        "size_label",
                                        e.target.value
                                      )
                                    }
                                    className="flex-1"
                                  />
                                ) : (
                                  <div className="flex flex-1 items-center rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                                    {sizeRow.size_label}
                                  </div>
                                )}
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Stok"
                                  value={sizeRow.stock}
                                  onChange={(e) =>
                                    updateSizeInColor(
                                      ci,
                                      origIdx,
                                      "stock",
                                      e.target.value
                                    )
                                  }
                                  className="w-20"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    removeSizeFromColor(ci, origIdx)
                                  }
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}

                          {/* Custom size button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addSizeToColor(ci, "", true)}
                            className="self-start"
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Özel Beden Ekle
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {colorGroups.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Başlamak için yukarıdan bir renk seçin
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 border-t bg-background px-4 py-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-11 w-full font-semibold"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Kaydet" : "Ürün Ekle"}
          </Button>

          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {deleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Trash2 className="mr-2 h-4 w-4" />
                  Ürünü Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Ürünü silmek istediğinize emin misiniz?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{product?.name}&rdquo; kalıcı olarak silinecek. Bu
                    işlem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
