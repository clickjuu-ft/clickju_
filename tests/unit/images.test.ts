import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { db, schema } from "@/lib/db";
import { createPhotoFromUpload, regenerateVariants } from "@/lib/photos";
import { analyze, hamming, ImageValidationError, inspect, qualityScore, watermarkSvg } from "@/lib/images/process";
import { groupSimilar, heuristicSequence, suggestSelection } from "@/lib/ai/similarity";
import { storage } from "@/lib/storage";
import { makeJpeg } from "./helpers";
import { eq } from "drizzle-orm";

describe("processamento de imagens", () => {
  it("recusa arquivos que não são imagem", async () => {
    await expect(inspect(Buffer.from("texto qualquer"))).rejects.toBeInstanceOf(ImageValidationError);
  });

  it("gera variantes AVIF/WebP sem enlarguecer e preserva o original byte a byte", async () => {
    const [project] = await db.insert(schema.projects).values({ slug: `img-${Date.now()}`, title: "img", watermark: false }).returning();
    const original = await makeJpeg(2000, 1200);
    const photo = await createPhotoFromUpload({ projectId: project.id, batchId: null, buffer: original, originalName: "x.jpg" });
    expect(photo.variants.map((v) => v.w)).toEqual([480, 960, 1600, 2000]);
    const stored = await storage().get(photo.originalKey);
    expect(stored!.body.equals(original)).toBe(true);
    const avif = await storage().get(photo.variants[0].avif);
    expect((await sharp(avif!.body).metadata()).format).toBe("heif");
    expect(photo.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(photo.qualityScore).toBeGreaterThanOrEqual(0);

    // marca-d'água: regenerar não altera o original
    await db.update(schema.projects).set({ watermark: true }).where(eq(schema.projects.id, project.id));
    await regenerateVariants([photo.id]);
    const after = await db.query.photos.findFirst({ where: eq(schema.photos.id, photo.id) });
    expect(after!.variantsWatermarked).toBe(true);
    expect((await storage().get(photo.originalKey))!.body.equals(original)).toBe(true);
  });

  it("marca-d'água escapa o texto (sem injeção de SVG)", () => {
    const svg = watermarkSvg(800, 600, { enabled: true, text: '<script>"x"</script>', opacity: 0.3, position: "tiled", scale: 0.3 }).toString();
    expect(svg).not.toContain("<script>");
  });

  it("análise técnica: foto nítida tem nota maior que a desfocada", async () => {
    const sharpImg = await makeJpeg(1200, 800);
    const blurred = await sharp(sharpImg).blur(12).jpeg().toBuffer();
    const a = await analyze(sharpImg);
    const b = await analyze(blurred);
    expect(a.sharpness).toBeGreaterThan(b.sharpness);
    expect(qualityScore(a)).toBeGreaterThan(qualityScore(b));
  });

  it("detecta semelhantes e sugere a melhor de cada grupo", async () => {
    const base = await makeJpeg(800, 600, "#8b5cf6");
    const near = await sharp(base).modulate({ brightness: 1.03 }).jpeg().toBuffer();
    const diff = await makeJpeg(800, 600, "#10b981");
    const [x, y, z] = await Promise.all([analyze(base), analyze(near), analyze(diff)]);
    expect(hamming(x.dhash, y.dhash)).toBeLessThanOrEqual(8);
    const items = [
      { id: "a", dhash: x.dhash, colorVector: x.colorVector, embedding: null, qualityScore: 70, takenAt: null },
      { id: "b", dhash: y.dhash, colorVector: y.colorVector, embedding: null, qualityScore: 50, takenAt: null },
      { id: "c", dhash: z.dhash.split("").reverse().join(""), colorVector: z.colorVector, embedding: null, qualityScore: 60, takenAt: null },
    ];
    const groups = groupSimilar(items);
    const ab = groups.find((g) => g.some((p) => p.id === "a"))!;
    expect(ab.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(suggestSelection(groups).map((p) => p.id).sort()).toEqual(["a", "c"]);
    const seq = heuristicSequence(items, groups);
    expect(seq).toHaveLength(3);
    expect(seq[0] === "a" && seq[1] === "b").toBe(false); // evita semelhantes em sequência
  });
});
