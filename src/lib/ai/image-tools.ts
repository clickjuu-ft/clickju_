import "server-only";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

/**
 * Ferramentas de imagem. Regra: o arquivo original NUNCA é sobrescrito — cada operação
 * gera um arquivo novo em derived/<photoId>/<jobId>.<ext>, registrado em image_jobs.
 */
export const LOCAL_TOOLS = {
  denoise: { label: "Redução de ruído (mediana)", provider: "local" },
  lighting: { label: "Correção assistida de iluminação (normalização + CLAHE)", provider: "local" },
  web: { label: "Preparação para web (2048px, WebP, sem metadados)", provider: "local" },
  crop_square: { label: "Redimensionamento inteligente 1:1 (recorte por atenção)", provider: "local" },
  crop_portrait: { label: "Redimensionamento inteligente 4:5 (recorte por atenção)", provider: "local" },
  crop_wide: { label: "Redimensionamento inteligente 16:9 (recorte por atenção)", provider: "local" },
} as const;

export const REMOTE_TOOLS = {
  upscale: { label: "Aprimoramento de resolução (Replicate)", provider: "replicate" },
  remove_bg: { label: "Remoção de fundo (Replicate)", provider: "replicate" },
} as const;

export type ToolName = keyof typeof LOCAL_TOOLS | keyof typeof REMOTE_TOOLS;

export function remoteToolAvailable(tool: keyof typeof REMOTE_TOOLS) {
  if (!env.ai.replicateToken) return false;
  return tool === "upscale" ? !!env.ai.replicateUpscaleModel : !!env.ai.replicateBackgroundModel;
}

async function runLocal(tool: keyof typeof LOCAL_TOOLS, input: Buffer): Promise<{ buf: Buffer; ext: string; mime: string }> {
  const base = sharp(input, { limitInputPixels: 120_000_000 }).rotate();
  const crop = (w: number, h: number) =>
    base.resize(w, h, { fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  switch (tool) {
    case "denoise":
      return { buf: await base.median(3).jpeg({ quality: 95 }).toBuffer(), ext: "jpg", mime: "image/jpeg" };
    case "lighting":
      return {
        buf: await base.normalise({ lower: 1, upper: 99 }).clahe({ width: 64, height: 64, maxSlope: 3 }).jpeg({ quality: 95 }).toBuffer(),
        ext: "jpg",
        mime: "image/jpeg",
      };
    case "web":
      return { buf: await base.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(), ext: "webp", mime: "image/webp" };
    case "crop_square":
      return { buf: await crop(2048, 2048), ext: "jpg", mime: "image/jpeg" };
    case "crop_portrait":
      return { buf: await crop(1638, 2048), ext: "jpg", mime: "image/jpeg" };
    case "crop_wide":
      return { buf: await crop(2048, 1152), ext: "jpg", mime: "image/jpeg" };
  }
}

/**
 * Replicate: cria a predição com o modelo configurado ("dono/modelo" ou "dono/modelo:versão"),
 * envia a imagem como data URI e aguarda o resultado (até ~2 minutos).
 */
async function runReplicate(tool: keyof typeof REMOTE_TOOLS, input: Buffer): Promise<{ buf: Buffer; ext: string; mime: string }> {
  const model = tool === "upscale" ? env.ai.replicateUpscaleModel! : env.ai.replicateBackgroundModel!;
  const small = await sharp(input).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const image = `data:image/png;base64,${small.toString("base64")}`;
  const [name, version] = model.split(":");
  const url = version ? "https://api.replicate.com/v1/predictions" : `https://api.replicate.com/v1/models/${name}/predictions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.ai.replicateToken}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ ...(version ? { version } : {}), input: { image } }),
  });
  if (!res.ok) throw new Error(`Replicate: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  let pred = (await res.json()) as { status: string; output: unknown; error?: string; urls?: { get: string } };
  const started = Date.now();
  while (["starting", "processing"].includes(pred.status) && Date.now() - started < 120_000) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(pred.urls!.get, { headers: { Authorization: `Bearer ${env.ai.replicateToken}` } });
    pred = await poll.json();
  }
  if (pred.status !== "succeeded") throw new Error(`Replicate: ${pred.error ?? pred.status}`);
  const outUrl = Array.isArray(pred.output) ? pred.output[pred.output.length - 1] : pred.output;
  if (typeof outUrl !== "string" || !outUrl.startsWith("https://")) throw new Error("Replicate: saída inesperada");
  const dl = await fetch(outUrl);
  const buf = Buffer.from(await dl.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const ext = meta.format === "jpeg" ? "jpg" : (meta.format ?? "png");
  return { buf, ext, mime: `image/${meta.format === "jpeg" ? "jpeg" : (meta.format ?? "png")}` };
}

export async function runImageTool(photoId: string, tool: ToolName) {
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
  if (!photo) throw new Error("Foto não encontrada");
  const isLocal = tool in LOCAL_TOOLS;
  if (!isLocal && !remoteToolAvailable(tool as keyof typeof REMOTE_TOOLS)) {
    throw new Error("Integração não configurada. Defina REPLICATE_API_TOKEN e o modelo correspondente (veja o README).");
  }
  const [job] = await db.insert(schema.imageJobs).values({ photoId, tool, provider: isLocal ? "local" : "replicate", status: "pending" }).returning();
  try {
    const original = await storage().get(photo.originalKey);
    if (!original) throw new Error("Original não encontrado");
    const out = isLocal
      ? await runLocal(tool as keyof typeof LOCAL_TOOLS, original.body)
      : await runReplicate(tool as keyof typeof REMOTE_TOOLS, original.body);
    const key = `derived/${photoId}/${job.id}.${out.ext}`;
    await storage().put(key, out.buf, out.mime);
    await db.update(schema.imageJobs).set({ status: "done", outputKey: key }).where(eq(schema.imageJobs.id, job.id));
    return { ok: true as const, jobId: job.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(schema.imageJobs).set({ status: "failed", error: msg.slice(0, 500) }).where(eq(schema.imageJobs.id, job.id));
    return { ok: false as const, error: msg };
  }
}
