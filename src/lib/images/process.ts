import "server-only";
import sharp from "sharp";
import type { PhotoVariant } from "@/lib/db/schema";
import type { WatermarkSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { randomToken } from "@/lib/crypto";

type SharpImage = ReturnType<typeof sharp>;
type SharpMetadata = Awaited<ReturnType<SharpImage["metadata"]>>;

sharp.cache(false);
sharp.concurrency(2);

export const VARIANT_WIDTHS = [480, 960, 1600, 2400] as const;
const MAX_PIXELS = 120_000_000; // ~120 MP
const ACCEPTED = new Set(["jpeg", "png", "webp", "tiff", "heif", "avif"]);

export class ImageValidationError extends Error {}

export type ImageAnalysis = {
  width: number;
  height: number;
  format: string;
  takenAt: Date | null;
  blurDataUrl: string;
  dominantColor: string;
  dhash: string;
  colorVector: number[];
  sharpness: number;
  brightness: number;
  clippedHighlights: number;
  clippedShadows: number;
  qualityScore: number;
};

/** Valida o conteúdo real do arquivo (não confia na extensão nem no MIME enviado). */
export async function inspect(buf: Buffer) {
  let meta: SharpMetadata;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new ImageValidationError("O arquivo não é uma imagem válida.");
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new ImageValidationError("Formato não suportado. Envie JPEG, PNG, WebP, TIFF, HEIC ou AVIF.");
  }
  if (!meta.width || !meta.height) throw new ImageValidationError("Não foi possível ler as dimensões da imagem.");
  if (meta.width * meta.height > MAX_PIXELS) throw new ImageValidationError("Imagem acima do limite de 120 megapixels.");
  return meta;
}

export function mimeForFormat(format: string): string {
  return (
    { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", tiff: "image/tiff", heif: "image/heic", avif: "image/avif" } as Record<
      string,
      string
    >
  )[format] ?? "application/octet-stream";
}

export function extForFormat(format: string): string {
  return ({ jpeg: "jpg", heif: "heic" } as Record<string, string>)[format] ?? format;
}

function exifDate(exif?: Buffer): Date | null {
  if (!exif) return null;
  const matches = exif.toString("latin1").match(/\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/g);
  if (!matches?.length) return null;
  // DateTimeOriginal costuma ser a última ocorrência (após DateTime de modificação)
  const m = matches[matches.length - 1];
  const d = new Date(m.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hash perceptual (dHash 64 bits) para detectar imagens semelhantes. */
async function dhash(img: SharpImage): Promise<string> {
  const { data } = await img.clone().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Histograma de cor (8 faixas por canal, normalizado) — usado no agrupamento por similaridade. */
async function colorVector(img: SharpImage): Promise<number[]> {
  const { data } = await img.clone().removeAlpha().resize(64, 64, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const hist = new Array(24).fill(0);
  for (let i = 0; i < data.length; i += 3) {
    hist[data[i] >> 5]++;
    hist[8 + (data[i + 1] >> 5)]++;
    hist[16 + (data[i + 2] >> 5)]++;
  }
  const total = data.length / 3;
  return hist.map((v) => Number((v / total).toFixed(4)));
}

/** Nitidez (variância do Laplaciano) e exposição, calculadas localmente. */
async function technical(img: SharpImage) {
  const grey = img.clone().greyscale().resize(800, 800, { fit: "inside" });
  const { data: lap } = await grey
    .clone()
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sumSq = 0;
  for (const v of lap) {
    const d = v - 128;
    sum += d;
    sumSq += d * d;
  }
  const n = lap.length;
  const variance = sumSq / n - (sum / n) ** 2;

  const { data: px } = await grey.raw().toBuffer({ resolveWithObject: true });
  let lum = 0;
  let hi = 0;
  let lo = 0;
  for (const v of px) {
    lum += v;
    if (v >= 250) hi++;
    if (v <= 5) lo++;
  }
  return {
    sharpness: Number(variance.toFixed(2)),
    brightness: Number((lum / px.length / 255).toFixed(4)),
    clippedHighlights: Number((hi / px.length).toFixed(4)),
    clippedShadows: Number((lo / px.length).toFixed(4)),
  };
}

/**
 * Nota técnica 0–100 (não é julgamento artístico): nitidez + exposição.
 * Fotografias low-key/high-key intencionais podem receber nota menor — por isso é só sugestão.
 */
export function qualityScore(t: { sharpness: number; brightness: number; clippedHighlights: number; clippedShadows: number }) {
  const sharp = Math.min(1, Math.log10(1 + t.sharpness) / 3); // ~1000 de variância → 1
  const exposure = 1 - Math.min(1, Math.abs(t.brightness - 0.45) / 0.45);
  const clipping = 1 - Math.min(1, (t.clippedHighlights + t.clippedShadows) * 4);
  return Math.round((sharp * 0.6 + exposure * 0.25 + clipping * 0.15) * 100);
}

export async function analyze(buf: Buffer): Promise<ImageAnalysis> {
  const meta = await inspect(buf);
  const base = sharp(buf, { limitInputPixels: MAX_PIXELS }).rotate(); // aplica orientação EXIF
  const rotatedSwap = (meta.orientation ?? 1) >= 5;
  const width = rotatedSwap ? meta.height! : meta.width!;
  const height = rotatedSwap ? meta.width! : meta.height!;

  const [blur, stats, hash, colors, tech] = await Promise.all([
    base.clone().resize(24, 24, { fit: "inside" }).webp({ quality: 40 }).toBuffer(),
    base.clone().resize(200, 200, { fit: "inside" }).stats(),
    dhash(base),
    colorVector(base),
    technical(base),
  ]);
  const d = stats.dominant;
  const hex = `#${[d.r, d.g, d.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  return {
    width,
    height,
    format: meta.format!,
    takenAt: exifDate(meta.exif),
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    dominantColor: hex,
    dhash: hash,
    colorVector: colors,
    ...tech,
    qualityScore: qualityScore(tech),
  };
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Gera a camada SVG da marca-d'água para uma imagem de largura/altura dadas. */
export function watermarkSvg(w: number, h: number, wm: WatermarkSettings): Buffer {
  const text = escapeXml(wm.text || "©");
  const fontSize = Math.max(12, Math.round((w * wm.scale) / Math.max(6, wm.text.length * 0.55)));
  const pad = Math.round(fontSize * 0.9);
  const style = `font-family: 'DejaVu Sans', Arial, sans-serif; font-weight: 600; letter-spacing: 0.08em; fill: #fff; fill-opacity: ${wm.opacity};`;
  let body: string;
  if (wm.position === "tiled") {
    const stepX = fontSize * Math.max(8, wm.text.length * 0.7);
    const stepY = fontSize * 5;
    let tiles = "";
    for (let y = -h; y < h * 2; y += stepY) {
      for (let x = -w; x < w * 2; x += stepX) tiles += `<text x="${x}" y="${y}" style="${style}" font-size="${fontSize}">${text}</text>`;
    }
    body = `<g transform="rotate(-24 ${w / 2} ${h / 2})">${tiles}</g>`;
  } else {
    const anchor = wm.position === "center" ? "middle" : wm.position === "bottom-left" ? "start" : "end";
    const x = wm.position === "center" ? w / 2 : wm.position === "bottom-left" ? pad : w - pad;
    const y = wm.position === "center" ? h / 2 + fontSize / 3 : h - pad;
    body = `<text x="${x}" y="${y}" text-anchor="${anchor}" style="${style}" font-size="${fontSize}">${text}</text>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
}

/**
 * Gera variantes otimizadas a partir do original (nunca o altera).
 * Metadados EXIF (incluindo GPS) são removidos das variantes.
 */
export async function generateVariants(
  photoId: string,
  original: Buffer,
  watermark: WatermarkSettings | null,
): Promise<PhotoVariant[]> {
  const meta = await inspect(original);
  const rotatedSwap = (meta.orientation ?? 1) >= 5;
  const srcW = rotatedSwap ? meta.height! : meta.width!;
  const rev = randomToken(4).replace(/[^a-zA-Z0-9]/g, "x");
  const widths: number[] = VARIANT_WIDTHS.filter((w) => w < srcW);
  widths.push(Math.min(srcW, VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]));
  const unique = [...new Set(widths)].sort((a, b) => a - b);
  const out: PhotoVariant[] = [];
  for (const w of unique) {
    let pipeline = sharp(original, { limitInputPixels: MAX_PIXELS }).rotate().resize({ width: w, withoutEnlargement: true });
    const resized = await pipeline.toBuffer({ resolveWithObject: true });
    pipeline = sharp(resized.data);
    if (watermark) {
      pipeline = pipeline.composite([{ input: watermarkSvg(resized.info.width, resized.info.height, watermark), top: 0, left: 0 }]);
    }
    const flat = await pipeline.toBuffer();
    const [avif, webp] = await Promise.all([
      sharp(flat).avif({ quality: 52, effort: 2 }).toBuffer(),
      sharp(flat).webp({ quality: 80 }).toBuffer(),
    ]);
    const prefix = `v/${photoId}/${rev}/${w}`;
    await Promise.all([
      storage().put(`${prefix}.avif`, avif, "image/avif"),
      storage().put(`${prefix}.webp`, webp, "image/webp"),
    ]);
    out.push({ w: resized.info.width, h: resized.info.height, avif: `${prefix}.avif`, webp: `${prefix}.webp` });
  }
  return out;
}

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
