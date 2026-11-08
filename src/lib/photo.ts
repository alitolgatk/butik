import { getSupabase } from "@/lib/supabase";

/**
 * Ürün fotoğrafları için yardımcılar.
 *
 * Neden var: Supabase ücretsiz planında "cached egress" (çıkış trafiği) limiti
 * var. Telefondan çekilen fotoğraflar 3-8 MB olduğu için, orijinal boyutta
 * yüklenip her listede tekrar indirilince limit hızla doluyor ve Storage servisi
 * 402 ile kısıtlanıyor. Bu yüzden:
 *   - yüklemeden önce fotoğraf küçültülür (tam boy + küçük önizleme),
 *   - listelerde küçük önizleme kullanılır,
 *   - dosyalara 1 yıllık önbellek verilir (dosya adları benzersiz).
 *
 * Yeni dosyalar "v2-" ile başlar ve yanında "_t" sonekli önizleme dosyası olur.
 * Eski (v2 olmayan) fotoğraflar olduğu gibi çalışmaya devam eder.
 */

export const PHOTO_BUCKET = "product-photos";

const FULL_MAX = 900;
const THUMB_MAX = 400;
const FULL_QUALITY = 0.8;
const THUMB_QUALITY = 0.75;
const NEW_PREFIX = "v2-";
const CACHE_ONE_YEAR = "31536000";

/** Supabase kotası/kısıtlaması yüzünden Storage kullanılamıyor. */
export class PhotoQuotaError extends Error {
  constructor() {
    super(
      "Supabase depolama kotası dolu, fotoğraflar şu an yüklenemiyor veya indirilemiyor."
    );
    this.name = "PhotoQuotaError";
  }
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; statusCode?: unknown; message?: unknown };
  const code = Number(e.status ?? e.statusCode);
  if (code === 402) return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return /restricted|exceed_|quota/i.test(msg);
}

// ─── URL yardımcıları ───

function fileNameFromUrl(url: string): string | null {
  const marker = `/${PHOTO_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const raw = url.slice(i + marker.length).split("?")[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function thumbFileName(fileName: string): string {
  return fileName.replace(/(\.[A-Za-z0-9]+)$/, "_t$1");
}

/** Fotoğraf yeni (küçültülmüş) biçimde mi? */
export function isOptimizedPhoto(url: string | null): boolean {
  if (!url) return false;
  const name = fileNameFromUrl(url);
  return !!name && name.startsWith(NEW_PREFIX);
}

/** Listelerde kullanılacak küçük önizleme adresi (eski fotoğraflarda aynı adres). */
export function photoThumb(url: string | null): string | null {
  if (!url) return null;
  const name = fileNameFromUrl(url);
  if (!name || !name.startsWith(NEW_PREFIX)) return url;
  const i = url.lastIndexOf(name);
  if (i < 0) return url;
  return url.slice(0, i) + thumbFileName(name);
}

// ─── Resim işleme ───

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bmp,
        width: bmp.width,
        height: bmp.height,
        close: () => bmp.close(),
      };
    } catch {
      // eski tarayıcı: aşağıdaki <img> yoluna düş
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

let webpSupported: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpSupported === null) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      webpSupported = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      webpSupported = false;
    }
  }
  return webpSupported;
}

async function encode(
  img: Decoded,
  maxSide: number,
  quality: number
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tarayıcı fotoğrafı işleyemedi");
  // Saydam PNG'ler JPEG'e çevrilirken siyah olmasın
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img.source, 0, 0, w, h);

  const useWebp = canEncodeWebp();
  const mime = useWebp ? "image/webp" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality)
  );
  if (!blob) throw new Error("Fotoğraf küçültülemedi");
  return { blob, ext: useWebp ? "webp" : "jpg" };
}

// ─── Yükle / sil ───

/**
 * Fotoğrafı küçültüp (tam boy + önizleme) Storage'a yükler.
 * Tam boy dosyanın herkese açık adresini döndürür.
 */
export async function uploadProductPhoto(file: Blob): Promise<{
  url: string;
  bytes: number;
}> {
  const img = await decode(file);
  let full: Awaited<ReturnType<typeof encode>>;
  let thumb: Awaited<ReturnType<typeof encode>>;
  try {
    full = await encode(img, FULL_MAX, FULL_QUALITY);
    thumb = await encode(img, THUMB_MAX, THUMB_QUALITY);
  } finally {
    img.close();
  }

  const supabase = getSupabase();
  const id = `${NEW_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fullName = `${id}.${full.ext}`;
  const thumbName = thumbFileName(fullName);
  const opts = { cacheControl: CACHE_ONE_YEAR, upsert: false } as const;

  const { error: thumbErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(thumbName, thumb.blob, { ...opts, contentType: thumb.blob.type });
  if (thumbErr) {
    if (isQuotaError(thumbErr)) throw new PhotoQuotaError();
    throw new Error("Fotoğraf yüklenemedi: " + thumbErr.message);
  }

  const { error: fullErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(fullName, full.blob, { ...opts, contentType: full.blob.type });
  if (fullErr) {
    await supabase.storage.from(PHOTO_BUCKET).remove([thumbName]);
    if (isQuotaError(fullErr)) throw new PhotoQuotaError();
    throw new Error("Fotoğraf yüklenemedi: " + fullErr.message);
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fullName);
  return { url: data.publicUrl, bytes: full.blob.size + thumb.blob.size };
}

/** Fotoğrafı (ve varsa önizlemesini) Storage'dan siler. Hata fırlatmaz. */
export async function removeProductPhoto(url: string | null): Promise<boolean> {
  if (!url) return true;
  const name = fileNameFromUrl(url);
  if (!name) return true;
  const names = name.startsWith(NEW_PREFIX) ? [name, thumbFileName(name)] : [name];
  const { error } = await getSupabase().storage.from(PHOTO_BUCKET).remove(names);
  if (error) {
    console.error("Fotoğraf silinemedi:", error);
    return false;
  }
  return true;
}

// ─── Eski fotoğrafları küçültme (tek seferlik bakım) ───

export interface OptimizeResult {
  before: number;
  after: number;
  oldRemoved: boolean;
}

/**
 * Eski, büyük bir ürün fotoğrafını indirir, küçültüp yeniden yükler,
 * ürünün photo_url alanını günceller ve eski dosyayı siler.
 */
export async function optimizeExistingPhoto(product: {
  id: string;
  photo_url: string | null;
}): Promise<OptimizeResult | null> {
  const oldUrl = product.photo_url;
  if (!oldUrl || isOptimizedPhoto(oldUrl)) return null;

  const res = await fetch(oldUrl);
  if (res.status === 402) throw new PhotoQuotaError();
  if (!res.ok) throw new Error(`Fotoğraf indirilemedi (HTTP ${res.status})`);
  const original = await res.blob();

  const uploaded = await uploadProductPhoto(original);

  const { error } = await getSupabase()
    .from("products")
    .update({ photo_url: uploaded.url })
    .eq("id", product.id);
  if (error) {
    await removeProductPhoto(uploaded.url);
    throw new Error("Ürün güncellenemedi: " + error.message);
  }

  const oldRemoved = await removeProductPhoto(oldUrl);
  return { before: original.size, after: uploaded.bytes, oldRemoved };
}
