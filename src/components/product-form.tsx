"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Camera, ChevronDown, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
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

const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];

type VariantMode = "size_only" | "color_size";

interface SizeRow {
  id?: string;
  size_label: string;
  stock: number;
}

interface ColorGroup {
  colorName: string;
  expanded: boolean;
  sizes: SizeRow[];
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { variants?: ProductVariant[] }) | null;
  onSaved: () => void;
}

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

  // "Sadece Beden" state
  const [variantMode, setVariantMode] = useState<VariantMode>("size_only");
  const [sizeOnlyRows, setSizeOnlyRows] = useState<SizeRow[]>([]);

  // "Renk + Beden" state
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>([]);

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
        const hasColors = vs.some((v) => v.color_label);

        if (hasColors) {
          setVariantMode("color_size");
          setSizeOnlyRows([]);

          const grouped: Record<string, SizeRow[]> = {};
          for (const v of vs) {
            const color = v.color_label ?? "";
            if (!grouped[color]) grouped[color] = [];
            grouped[color].push({
              id: v.id,
              size_label: v.size_label ?? "",
              stock: v.stock,
            });
          }
          setColorGroups(
            Object.entries(grouped).map(([colorName, sizes]) => ({
              colorName,
              expanded: true,
              sizes,
            }))
          );
        } else {
          setVariantMode("size_only");
          setColorGroups([]);
          setSizeOnlyRows(
            vs.map((v) => ({
              id: v.id,
              size_label: v.size_label ?? "",
              stock: v.stock,
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
        setVariantMode("size_only");
        setSizeOnlyRows([]);
        setColorGroups([]);
      }
    }
  }, [open, product]);

  // ── Photo ──

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  // ── Size-only helpers ──

  function addSizeOnlyRow(label: string) {
    if (label && sizeOnlyRows.some((v) => v.size_label === label)) return;
    setSizeOnlyRows((prev) => [...prev, { size_label: label, stock: 0 }]);
  }

  function removeSizeOnlyRow(index: number) {
    setSizeOnlyRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSizeOnlyRow(index: number, field: keyof SizeRow, value: string | number) {
    setSizeOnlyRows((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  }

  // ── Color+Size helpers ──

  function addColorGroup() {
    setColorGroups((prev) => [
      ...prev,
      { colorName: "", expanded: true, sizes: [] },
    ]);
  }

  function removeColorGroup(ci: number) {
    setColorGroups((prev) => prev.filter((_, i) => i !== ci));
  }

  function updateColorName(ci: number, name: string) {
    setColorGroups((prev) =>
      prev.map((g, i) => (i === ci ? { ...g, colorName: name } : g))
    );
  }

  function toggleColorExpand(ci: number) {
    setColorGroups((prev) =>
      prev.map((g, i) => (i === ci ? { ...g, expanded: !g.expanded } : g))
    );
  }

  function addSizeToColor(ci: number, label: string) {
    setColorGroups((prev) =>
      prev.map((g, i) => {
        if (i !== ci) return g;
        if (label && g.sizes.some((s) => s.size_label === label)) return g;
        return { ...g, sizes: [...g.sizes, { size_label: label, stock: 0 }] };
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

  function updateSizeInColor(ci: number, si: number, field: keyof SizeRow, value: string | number) {
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

  function getAllVariantRows(): { id?: string; size_label: string; color_label: string | null; stock: number }[] {
    if (variantMode === "size_only") {
      return sizeOnlyRows.map((r) => ({
        id: r.id,
        size_label: r.size_label,
        color_label: null,
        stock: Number(r.stock),
      }));
    }
    const rows: { id?: string; size_label: string; color_label: string | null; stock: number }[] = [];
    for (const group of colorGroups) {
      const color = group.colorName.trim() || null;
      if (group.sizes.length === 0) {
        rows.push({ color_label: color, size_label: "", stock: 0 });
      } else {
        for (const s of group.sizes) {
          rows.push({
            id: s.id,
            size_label: s.size_label,
            color_label: color,
            stock: Number(s.stock),
          });
        }
      }
    }
    return rows;
  }

  function totalVariantCount(): number {
    if (variantMode === "size_only") return sizeOnlyRows.length;
    return colorGroups.reduce((sum, g) => sum + Math.max(g.sizes.length, 1), 0);
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
    if (hasVariants && totalVariantCount() === 0) {
      toast.error(
        variantMode === "size_only"
          ? "En az bir beden ekleyin"
          : "En az bir renk ekleyin"
      );
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
        const existingIds = allRows.filter((v) => v.id).map((v) => v.id!);

        if (isEditing) {
          if (existingIds.length > 0) {
            await supabase
              .from("product_variants")
              .delete()
              .eq("product_id", productId!)
              .not("id", "in", `(${existingIds.join(",")})`);
          } else {
            await supabase
              .from("product_variants")
              .delete()
              .eq("product_id", productId!);
          }
        }

        const toUpsert = allRows.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          product_id: productId!,
          size_label: v.size_label,
          color_label: v.color_label || null,
          stock: v.stock,
        }));

        if (toUpsert.length > 0) {
          const { error: varErr } = await supabase
            .from("product_variants")
            .upsert(toUpsert, { onConflict: "id" });
          if (varErr) throw varErr;
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
      toast.error(
        err instanceof Error ? err.message : "Bir hata oluştu"
      );
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
          if (storageErr) {
            console.error("Fotoğraf silinemedi:", storageErr);
          }
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
      toast.error(
        err instanceof Error ? err.message : "Silme başarısız"
      );
    } finally {
      setDeleting(false);
    }
  }

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
            {isEditing ? "Ürün bilgilerini düzenleyin" : "Yeni ürün bilgilerini girin"}
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
                Bu ürünün farklı bedenleri var
              </Label>
              <Switch
                id="has-variants"
                checked={hasVariants}
                onCheckedChange={setHasVariants}
              />
            </div>

            {/* Stock or Variants */}
            {!hasVariants ? (
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
            ) : (
              <div className="flex flex-col gap-4">
                {/* Mode toggle */}
                <div className="flex overflow-hidden rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setVariantMode("size_only")}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      variantMode === "size_only"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    Sadece Beden
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariantMode("color_size")}
                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                      variantMode === "color_size"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground"
                    }`}
                  >
                    Renk + Beden
                  </button>
                </div>

                {/* ── Sadece Beden ── */}
                {variantMode === "size_only" && (
                  <div className="flex flex-col gap-3">
                    <Label>Bedenler</Label>

                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SIZES.map((size) => {
                        const exists = sizeOnlyRows.some(
                          (v) => v.size_label === size
                        );
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => addSizeOnlyRow(size)}
                            disabled={exists}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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

                    <div className="flex flex-col gap-2">
                      {sizeOnlyRows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            placeholder="Beden"
                            value={row.size_label}
                            onChange={(e) =>
                              updateSizeOnlyRow(idx, "size_label", e.target.value)
                            }
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="Stok"
                            value={row.stock}
                            onChange={(e) =>
                              updateSizeOnlyRow(idx, "stock", e.target.value)
                            }
                            className="w-20"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSizeOnlyRow(idx)}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSizeOnlyRow("")}
                      className="self-start"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Özel Beden Ekle
                    </Button>
                  </div>
                )}

                {/* ── Renk + Beden ── */}
                {variantMode === "color_size" && (
                  <div className="flex flex-col gap-3">
                    {colorGroups.map((group, ci) => {
                      const totalStock = group.sizes.reduce(
                        (s, r) => s + Number(r.stock),
                        0
                      );
                      return (
                        <div
                          key={ci}
                          className="overflow-hidden rounded-lg border"
                        >
                          {/* Color header */}
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
                            <Input
                              placeholder="Renk adı"
                              value={group.colorName}
                              onChange={(e) => updateColorName(ci, e.target.value)}
                              className="h-8 flex-1 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                            />
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

                          {/* Expanded content */}
                          {group.expanded && (
                            <div className="flex flex-col gap-2.5 p-3">
                              {/* Quick size chips for this color */}
                              <div className="flex flex-wrap gap-1">
                                {QUICK_SIZES.map((size) => {
                                  const exists = group.sizes.some(
                                    (s) => s.size_label === size
                                  );
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => addSizeToColor(ci, size)}
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

                              {/* Size rows */}
                              {group.sizes.map((sizeRow, si) => (
                                <div
                                  key={si}
                                  className="flex items-center gap-2"
                                >
                                  <Input
                                    placeholder="Beden"
                                    value={sizeRow.size_label}
                                    onChange={(e) =>
                                      updateSizeInColor(ci, si, "size_label", e.target.value)
                                    }
                                    className="flex-1"
                                  />
                                  <Input
                                    type="number"
                                    min="0"
                                    placeholder="Stok"
                                    value={sizeRow.stock}
                                    onChange={(e) =>
                                      updateSizeInColor(ci, si, "stock", e.target.value)
                                    }
                                    className="w-20"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeSizeFromColor(ci, si)}
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addSizeToColor(ci, "")}
                                className="self-start"
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Özel Beden
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addColorGroup}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Yeni Renk Ekle
                    </Button>
                  </div>
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
                  <AlertDialogTitle>Ürünü silmek istediğinize emin misiniz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{product?.name}&rdquo; kalıcı olarak silinecek. Bu işlem geri alınamaz.
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
