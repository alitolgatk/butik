"use client";

import { ProductPhoto } from "@/components/product-photo";

interface ProductCardProps {
  name: string;
  price: number;
  photoUrl: string | null;
  totalStock: number;
  onClick: () => void;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ProductCard({
  name,
  price,
  photoUrl,
  totalStock,
  onClick,
}: ProductCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow active:shadow-md"
    >
      <div className="relative aspect-square w-full bg-muted/50">
        <ProductPhoto
          url={photoUrl}
          alt={name}
          variant="thumb"
          className="object-cover"
          iconClassName="h-10 w-10 text-muted-foreground/40"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-sm font-medium leading-tight">
          {name}
        </span>
        <span className="text-sm font-bold text-primary">
          {formatPrice(price)}
        </span>
        <span className="text-xs text-muted-foreground">
          Stok: {totalStock}
        </span>
      </div>
    </button>
  );
}
