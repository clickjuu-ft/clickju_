import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { PhotoVariant } from "@/lib/db/schema";
import { storage } from "@/lib/storage";
import { analyze, extForFormat, generateVariants, inspect, mimeForFormat } from "@/lib/images/process";
import { getSettings } from "@/lib/settings";

export type Photo = typeof schema.photos.$inferSelect;
export type Project = typeof schema.projects.$inferSelect;

/** Dados prontos para o componente <Picture>. Nunca inclui o original. */
export type PhotoView = {
  id: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  blur: string | null;
  color: string | null;
  avifSrcSet: string;
  webpSrcSet: string;
  src: string; // maior WebP disponível (para zoom/visualização ampliada)
  srcMedium: string;
  tags: string[];
  takenAt: string | null;
};

export function searchTextFor(p: { caption?: string | null; alt?: string | null; tags?: string[] | null }) {
  return [p.caption ?? "", p.alt ?? "", (p.tags ?? []).join(" ")].join(" ").trim();
}

export async function toView(photo: Photo, access: "public" | "private"): Promise<PhotoView> {
  const variants = [...(photo.variants as PhotoVariant[])].sort((a, b) => a.w - b.w);
  const s = storage();
  const signed = await Promise.all(
    variants.map(async (v) => ({
      w: v.w,
      avif: await s.signedUrl(v.avif, { access }),
      webp: await s.signedUrl(v.webp, { access }),
    })),
  );
  const largest = signed[signed.length - 1];
  const medium = signed.find((v) => v.w >= 960) ?? largest;
  return {
    id: photo.id,
    width: photo.width,
    height: photo.height,
    alt: photo.alt || photo.caption || "Fotografia",
    caption: photo.caption,
    blur: photo.blurDataUrl,
    color: photo.dominantColor,
    avifSrcSet: signed.map((v) => `${v.avif} ${v.w}w`).join(", "),
    webpSrcSet: signed.map((v) => `${v.webp} ${v.w}w`).join(", "),
    src: largest?.webp ?? "",
    srcMedium: medium?.webp ?? "",
    tags: photo.tags ?? [],
    takenAt: photo.takenAt ? photo.takenAt.toISOString() : null,
  };
}

export function projectAccessMode(project: Pick<Project, "visibility" | "published">): "public" | "private" {
  return project.visibility === "public" && project.published ? "public" : "private";
}

export async function watermarkFor(project: Pick<Project, "watermark">) {
  const settings = await getSettings();
  return project.watermark && settings.watermark.enabled ? settings.watermark : null;
}

/** Processa um upload: guarda o original intacto, gera variantes e análise técnica. */
export async function createPhotoFromUpload(opts: {
  projectId: string;
  batchId: string | null;
  buffer: Buffer;
  originalName: string;
  caption?: string | null;
  alt?: string | null;
  tags?: string[];
}) {
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, opts.projectId) });
  if (!project) throw new Error("Projeto não encontrado");
  const meta = await inspect(opts.buffer);
  const id = randomUUID();
  const originalKey = `originals/${id}.${extForFormat(meta.format!)}`;
  const s = storage();
  await s.put(originalKey, opts.buffer, mimeForFormat(meta.format!));
  try {
    const analysis = await analyze(opts.buffer);
    const wm = await watermarkFor(project);
    const variants = await generateVariants(id, opts.buffer, wm);
    const last = await db
      .select({ sort: schema.photos.sort })
      .from(schema.photos)
      .where(eq(schema.photos.projectId, project.id))
      .orderBy(asc(schema.photos.sort));
    const sort = last.length ? Math.max(...last.map((r) => r.sort)) + 1 : 0;
    const tags = opts.tags ?? [];
    const [row] = await db
      .insert(schema.photos)
      .values({
        id,
        projectId: project.id,
        batchId: opts.batchId,
        originalKey,
        originalName: opts.originalName.slice(0, 200),
        mime: mimeForFormat(meta.format!),
        bytes: opts.buffer.length,
        width: analysis.width,
        height: analysis.height,
        variants,
        variantsWatermarked: !!wm,
        blurDataUrl: analysis.blurDataUrl,
        dominantColor: analysis.dominantColor,
        caption: opts.caption ?? null,
        alt: opts.alt ?? null,
        tags,
        searchText: searchTextFor({ caption: opts.caption, alt: opts.alt, tags }),
        takenAt: analysis.takenAt,
        dhash: analysis.dhash,
        colorVector: analysis.colorVector,
        sharpness: analysis.sharpness,
        brightness: analysis.brightness,
        clippedHighlights: analysis.clippedHighlights,
        clippedShadows: analysis.clippedShadows,
        qualityScore: analysis.qualityScore,
        sort,
      })
      .returning();
    if (!project.coverPhotoId) {
      await db.update(schema.projects).set({ coverPhotoId: id }).where(eq(schema.projects.id, project.id));
    }
    return row;
  } catch (e) {
    // não deixa arquivos órfãos
    await s.delete(originalKey).catch(() => {});
    await s.deletePrefix(`v/${id}/`).catch(() => {});
    throw e;
  }
}

/** Regera as variantes (ex.: marca-d'água ligada/desligada). O original é apenas lido. */
export async function regenerateVariants(photoIds: string[]) {
  if (!photoIds.length) return 0;
  const rows = await db.query.photos.findMany({ where: inArray(schema.photos.id, photoIds) });
  let n = 0;
  for (const photo of rows) {
    const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, photo.projectId) });
    if (!project) continue;
    const original = await storage().get(photo.originalKey);
    if (!original) continue;
    const old = photo.variants as PhotoVariant[];
    const wm = await watermarkFor(project);
    const variants = await generateVariants(photo.id, original.body, wm);
    await db
      .update(schema.photos)
      .set({ variants, variantsWatermarked: !!wm, updatedAt: new Date() })
      .where(eq(schema.photos.id, photo.id));
    await Promise.all(old.flatMap((v) => [storage().delete(v.avif), storage().delete(v.webp)])).catch(() => {});
    n++;
  }
  return n;
}

export async function deletePhotos(photoIds: string[]) {
  if (!photoIds.length) return;
  const rows = await db.query.photos.findMany({ where: inArray(schema.photos.id, photoIds) });
  await db.delete(schema.photos).where(inArray(schema.photos.id, photoIds));
  // capa apontando para foto removida
  for (const r of rows) {
    await db
      .update(schema.projects)
      .set({ coverPhotoId: null })
      .where(and(eq(schema.projects.id, r.projectId), eq(schema.projects.coverPhotoId, r.id)));
  }
  const s = storage();
  for (const r of rows) {
    await s.delete(r.originalKey).catch(() => {});
    await s.deletePrefix(`v/${r.id}/`).catch(() => {});
    await s.deletePrefix(`derived/${r.id}/`).catch(() => {});
  }
}
