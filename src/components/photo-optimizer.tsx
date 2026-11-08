"use client";

import { useRef, useState } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  PhotoQuotaError,
  isOptimizedPhoto,
  optimizeExistingPhoto,
} from "@/lib/photo";
import { Button } from "@/components/ui/button";

interface PhotoOptimizerProps {
  products: { id: string; name: string; photo_url: string | null }[];
  onDone: () => void;
}

const MAX_CONSECUTIVE_FAILS = 3;

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * Eski (büyük) ürün fotoğraflarını tek tek indirip küçülterek yeniden yükler.
 * Küçültülecek fotoğraf kalmadığında hiçbir şey göstermez.
 */
export function PhotoOptimizer({ products, onDone }: PhotoOptimizerProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const stopRef = useRef(false);

  const pending = products.filter(
    (p) => p.photo_url && !isOptimizedPhoto(p.photo_url)
  );

  if (pending.length === 0 && !running && !message) return null;

  async function run() {
    const queue = [...pending];
    stopRef.current = false;
    setRunning(true);
    setMessage(null);
    setProgress(0);
    setTotal(queue.length);

    let ok = 0;
    let failed = 0;
    let consecutiveFails = 0;
    let before = 0;
    let after = 0;
    let stoppedReason: string | null = null;

    for (const product of queue) {
      if (stopRef.current) {
        stoppedReason = "Durduruldu.";
        break;
      }
      try {
        const result = await optimizeExistingPhoto(product);
        if (result) {
          ok++;
          before += result.before;
          after += result.after;
        }
        consecutiveFails = 0;
      } catch (err) {
        if (err instanceof PhotoQuotaError) {
          stoppedReason =
            "Supabase depolama kotası hâlâ dolu. Kota yenilenince veya plan yükseltilince tekrar deneyin.";
          break;
        }
        console.error("Fotoğraf küçültülemedi:", product.name, err);
        failed++;
        consecutiveFails++;
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
          stoppedReason =
            "Art arda hata alındı; bağlantı yok veya Supabase kotası dolu olabilir. Daha sonra tekrar deneyin.";
          break;
        }
      }
      setProgress(ok + failed);
    }

    const summary =
      `${ok} fotoğraf küçültüldü` +
      (ok > 0 ? ` (${formatMB(before)} MB → ${formatMB(after)} MB)` : "") +
      (failed > 0 ? `, ${failed} başarısız` : "") +
      ".";
    setMessage(stoppedReason ? `${summary} ${stoppedReason}` : summary);
    if (stoppedReason) toast.warning(stoppedReason);
    else toast.success(summary);

    setRunning(false);
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-start gap-2">
        <ImageDown className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-xs leading-relaxed">
          {running ? (
            <>
              Küçültülüyor: {progress} / {total}. Bu sayfadan ayrılmayın.
            </>
          ) : pending.length > 0 ? (
            <>
              {pending.length} ürün fotoğrafı büyük boyutta. Küçültmek Supabase
              kotasını korur ve uygulamayı hızlandırır.
            </>
          ) : null}
          {message && <p className={pending.length > 0 ? "mt-1" : ""}>{message}</p>}
        </div>
      </div>
      {pending.length > 0 && (
        <div className="flex gap-2">
          {running ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Durdur
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={run}>
              Fotoğrafları küçült
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
