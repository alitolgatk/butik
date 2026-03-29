"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { getSupabase } from "@/lib/supabase";
import type { Product, ProductVariant, Customer, SaleType } from "@/lib/types";
import type { CartItem } from "@/lib/cart";
import { cartItemKey, cartTotal, formatTL } from "@/lib/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VariantPicker } from "@/components/sales/variant-picker";
import { PaymentTypePicker } from "@/components/sales/payment-type-picker";
import { CustomerPicker } from "@/components/sales/customer-picker";
import { SaleSummary } from "@/components/sales/sale-summary";

type ProductWithVariants = Product & { variants: ProductVariant[] };

export default function SatisPage() {
  // -- Product data --
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // -- Cart --
  const [cart, setCart] = useState<CartItem[]>([]);

  // -- Variant picker --
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] =
    useState<ProductWithVariants | null>(null);

  // -- Payment flow --
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedSaleType, setSelectedSaleType] = useState<SaleType | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [optionalCustomer, setOptionalCustomer] = useState<Customer | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const customerJustSelected = useRef(false);

  // =========================================
  // Fetch products
  // =========================================
  const fetchProducts = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;

      const all = (data ?? []) as Product[];
      const variantIds = all.filter((p) => p.has_variants).map((p) => p.id);

      let variants: ProductVariant[] = [];
      if (variantIds.length > 0) {
        const { data: vData } = await supabase
          .from("product_variants")
          .select("*")
          .in("product_id", variantIds);
        variants = (vData ?? []) as ProductVariant[];
      }

      setProducts(
        all.map((p) => ({
          ...p,
          variants: variants.filter((v) => v.product_id === p.id),
        }))
      );
    } catch {
      // silent
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // =========================================
  // Filtered products
  // =========================================
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  // =========================================
  // Available stock accounting for cart
  // =========================================
  function availableStock(product: Product, variantId?: string): number {
    const inCart = cart
      .filter(
        (c) =>
          c.productId === product.id &&
          (variantId ? c.variantId === variantId : !c.variantId)
      )
      .reduce((s, c) => s + c.quantity, 0);

    if (variantId) {
      const pw = products.find((p) => p.id === product.id);
      const v = pw?.variants.find((vr) => vr.id === variantId);
      return Math.max(0, (v?.stock ?? 0) - inCart);
    }
    return Math.max(0, product.stock - inCart);
  }

  function totalAvailableStock(product: ProductWithVariants): number {
    if (product.has_variants) {
      return product.variants.reduce(
        (sum, v) => sum + availableStock(product, v.id),
        0
      );
    }
    return availableStock(product);
  }

  // =========================================
  // Add to cart
  // =========================================
  function handleProductTap(product: ProductWithVariants) {
    if (product.has_variants) {
      setVariantPickerProduct(product);
      setVariantPickerOpen(true);
      return;
    }

    if (availableStock(product) <= 0) {
      toast.warning(`${product.name} stoku tükenmiş, yine de eklendi`);
    }

    addToCart({
      productId: product.id,
      productName: product.name,
      photoUrl: product.photo_url,
      variantId: null,
      variantLabel: null,
      unitPrice: product.price,
      quantity: 1,
      maxStock: product.stock,
    });
  }

  function handleVariantSelect(variant: ProductVariant) {
    if (!variantPickerProduct) return;

    const parts = [variant.color_label, variant.size_label].filter(Boolean);
    const variantLabel = parts.length > 0 ? parts.join(" / ") : null;

    if (availableStock(variantPickerProduct, variant.id) <= 0) {
      toast.warning(`${variantPickerProduct.name} (${variantLabel ?? ""}) stoku tükenmiş, yine de eklendi`);
    }

    addToCart({
      productId: variantPickerProduct.id,
      productName: variantPickerProduct.name,
      photoUrl: variantPickerProduct.photo_url,
      variantId: variant.id,
      variantLabel,
      unitPrice: variantPickerProduct.price,
      quantity: 1,
      maxStock: variant.stock,
    });
  }

  function addToCart(newItem: CartItem) {
    setCart((prev) => {
      const key = cartItemKey(newItem);
      const existing = prev.find((c) => cartItemKey(c) === key);
      if (existing) {
        return prev.map((c) =>
          cartItemKey(c) === key
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, newItem];
    });
    toast.success(`${newItem.productName} sepete eklendi`);
  }

  function updateQuantity(item: CartItem, delta: number) {
    const key = cartItemKey(item);
    setCart((prev) =>
      prev
        .map((c) => {
          if (cartItemKey(c) !== key) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (delta > 0 && newQty > c.maxStock) {
            toast.warning("Stok sınırı aşıldı, yine de eklendi");
          }
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  }

  function removeFromCart(item: CartItem) {
    const key = cartItemKey(item);
    setCart((prev) => prev.filter((c) => cartItemKey(c) !== key));
  }

  // =========================================
  // Payment flow
  // =========================================
  function handlePaymentType(type: SaleType) {
    setSelectedSaleType(type);
    if (type === "acik_hesap" || type === "emanet") {
      setCustomerPickerOpen(true);
    } else {
      setSelectedCustomer(null);
      setSummaryOpen(true);
    }
  }

  function handleCustomerSelected(customer: Customer) {
    customerJustSelected.current = true;
    setSelectedCustomer(customer);
    setSummaryOpen(true);
  }

  function handleSaleCompleted() {
    setCart([]);
    setSelectedSaleType(null);
    setSelectedCustomer(null);
    setOptionalCustomer(null);
    setSearch("");
    fetchProducts();
  }

  const total = cartTotal(cart);

  // =========================================
  // Render
  // =========================================
  return (
    <>
      <div className="flex flex-col gap-4 px-4 pt-6">
        {/* Header */}
        <h1 className="text-xl font-bold tracking-tight">Satış</h1>

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

        {/* Product search results */}
        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : search.trim() ? (
          filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              &ldquo;{search}&rdquo; ile eşleşen ürün yok
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((p) => {
                const avail = totalAvailableStock(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductTap(p)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors active:bg-accent"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.photo_url ? (
                        <Image
                          src={p.photo_url}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-sm font-semibold text-primary">
                        {formatTL(p.price)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        avail > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {avail > 0 ? `${avail} stok` : "Stok yok"}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          /* No search, show prompt or product list */
          cart.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-3 rounded-full bg-muted p-4">
                <Search className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                Ürün eklemek için yukarıdan arayın
              </p>
            </div>
          )
        )}

        {/* When no search and we have products, show full list */}
        {!search.trim() && !productsLoading && (cart.length > 0 || products.length > 0) && (
          <>
            {cart.length > 0 && (
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tüm Ürünler
              </p>
            )}
            <div className="flex flex-col gap-1">
              {products.map((p) => {
                const avail = totalAvailableStock(p);
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductTap(p)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors active:bg-accent"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.photo_url ? (
                        <Image
                          src={p.photo_url}
                          alt={p.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-sm font-semibold text-primary">
                        {formatTL(p.price)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        avail > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {avail > 0 ? `${avail} stok` : "Stok yok"}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ========= CART ========= */}
        {cart.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Sepet ({cart.length})
            </p>

            {cart.map((item) => {
              const key = cartItemKey(item);
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-xl border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {item.productName}
                      {item.variantLabel && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({item.variantLabel})
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-primary">
                      {formatTL(item.unitPrice * item.quantity)}
                    </p>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background transition-colors active:bg-accent"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background transition-colors active:bg-accent"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeFromCart(item)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}

            {/* Cart footer */}
            <div className="mt-1 flex flex-col gap-3 rounded-xl bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Toplam</span>
                <span className="text-xl font-bold text-primary">
                  {formatTL(total)}
                </span>
              </div>
              <Button
                onClick={() => setPaymentOpen(true)}
                className="h-12 w-full gap-2 text-base font-semibold"
              >
                Ödemeye Geç
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ========= SHEETS ========= */}

      {/* Variant picker */}
      {variantPickerProduct && (
        <VariantPicker
          key={variantPickerProduct.id}
          open={variantPickerOpen}
          onOpenChange={setVariantPickerOpen}
          productName={variantPickerProduct.name}
          variants={variantPickerProduct.variants}
          onSelect={handleVariantSelect}
        />
      )}

      {/* Payment type */}
      <PaymentTypePicker
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onSelect={handlePaymentType}
      />

      {/* Customer picker */}
      {selectedSaleType && (
        <CustomerPicker
          open={customerPickerOpen}
          onOpenChange={(open) => {
            setCustomerPickerOpen(open);
            if (!open) {
              if (!customerJustSelected.current) {
                setSelectedSaleType(null);
              }
              customerJustSelected.current = false;
            }
          }}
          saleType={selectedSaleType}
          onSelect={handleCustomerSelected}
        />
      )}

      {/* Sale summary */}
      {selectedSaleType && (
        <SaleSummary
          open={summaryOpen}
          onOpenChange={(open) => {
            setSummaryOpen(open);
            if (!open) {
              setSelectedSaleType(null);
              setSelectedCustomer(null);
            }
          }}
          items={cart}
          saleType={selectedSaleType}
          customer={selectedCustomer}
          optionalCustomer={optionalCustomer}
          onOptionalCustomerChange={setOptionalCustomer}
          onCompleted={handleSaleCompleted}
        />
      )}
    </>
  );
}
