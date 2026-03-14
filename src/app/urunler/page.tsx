"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackageOpen, Plus, Search } from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import type { Product, ProductVariant } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/product-card";
import { ProductForm } from "@/components/product-form";

type ProductWithVariants = Product & { variants?: ProductVariant[] };

export default function UrunlerPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithVariants | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const productsData = (data ?? []) as Product[];

      const variantProductIds = productsData
        .filter((p) => p.has_variants)
        .map((p) => p.id);

      let allVariants: ProductVariant[] = [];
      if (variantProductIds.length > 0) {
        const { data: vData } = await supabase
          .from("product_variants")
          .select("*")
          .in("product_id", variantProductIds);
        allVariants = (vData ?? []) as ProductVariant[];
      }

      const merged: ProductWithVariants[] = productsData.map((p) => ({
        ...p,
        variants: allVariants.filter((v) => v.product_id === p.id),
      }));

      setProducts(merged);
    } catch {
      // Supabase not configured or network error — leave products empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  function getTotalStock(p: ProductWithVariants): number {
    if (p.has_variants && p.variants && p.variants.length > 0) {
      return p.variants.reduce((sum, v) => sum + v.stock, 0);
    }
    return p.stock;
  }

  function openAdd() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(product: ProductWithVariants) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleSaved() {
    fetchProducts();
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        {/* Header */}
        <h1 className="text-xl font-bold tracking-tight">Ürünler</h1>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ürün ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted p-5">
              <PackageOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            {search ? (
              <>
                <p className="font-medium text-foreground">Sonuç bulunamadı</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  &ldquo;{search}&rdquo; ile eşleşen ürün yok
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  Henüz ürün eklenmedi
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sağ alttaki + butonuna basarak ilk ürününüzü ekleyin
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                price={product.price}
                photoUrl={product.photo_url}
                totalStock={getTotalStock(product)}
                onClick={() => openEdit(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Product form sheet */}
      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSaved={handleSaved}
      />
    </>
  );
}
