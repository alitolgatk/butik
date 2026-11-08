"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";

import { photoThumb } from "@/lib/photo";

interface ProductPhotoProps {
  url: string | null;
  alt: string;
  /** "thumb": listelerde küçük önizleme, "full": tam boy fotoğraf */
  variant: "thumb" | "full";
  className?: string;
  iconClassName?: string;
}

/**
 * Üst elemanı dolduran ürün fotoğrafı (üst eleman `relative` olmalı).
 * Fotoğraf yüklenemezse (silinmiş, Supabase kotası dolu vb.) bozuk resim yerine
 * ShoppingBag simgesi gösterir. Önizleme yüklenemezse bir kez tam boya düşer.
 */
export function ProductPhoto({
  url,
  alt,
  variant,
  className,
  iconClassName = "h-5 w-5 text-muted-foreground/40",
}: ProductPhotoProps) {
  // 0: asıl adres, 1: tam boy adres (önizleme bozuksa), 2: yer tutucu
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
  }, [url]);

  const primary = variant === "thumb" ? photoThumb(url) : url;
  const src = stage === 0 ? primary : stage === 1 ? url : null;

  function handleError() {
    if (stage === 0 && primary !== url && url) setStage(1);
    else setStage(2);
  }

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ShoppingBag className={iconClassName} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      unoptimized
      onError={handleError}
    />
  );
}
