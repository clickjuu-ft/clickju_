import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { createPhotoFromUpload } from "@/lib/photos";

const IMAGE = /\.(jpe?g|png|webp|tiff?|heic|heif|avif)$/i;

/** Fotos soltas na raiz do bucket (enviadas fora do site, ex.: painel do Supabase). */
export async function pendingBucketImports() {
  return (await storage().listRoot()).filter((k) => IMAGE.test(k)).sort();
}

/**
 * Importa até `limit` fotos soltas para o projeto "Fotos importadas" (rascunho).
 * Cada uma vira um upload normal (original preservado + variantes); o arquivo solto é removido.
 */
export async function importBucketRoot(limit = 3) {
  const keys = (await pendingBucketImports()).slice(0, limit);
  if (!keys.length) return { imported: 0, failed: [] as string[], projectId: null as string | null };
  let project = await db.query.projects.findFirst({ where: eq(schema.projects.slug, "fotos-importadas") });
  if (!project) {
    [project] = await db
      .insert(schema.projects)
      .values({
        slug: "fotos-importadas",
        title: "Fotos importadas",
        summary: "Fotos enviadas diretamente ao armazenamento. Organize, renomeie e publique pelo painel.",
        visibility: "public",
        published: false,
      })
      .returning();
  }
  let imported = 0;
  const failed: string[] = [];
  for (const key of keys) {
    try {
      // se uma execução anterior caiu depois de salvar a foto, só remove o arquivo solto
      const already = await db.query.photos.findFirst({ where: and(eq(schema.photos.projectId, project.id), eq(schema.photos.originalName, key)) });
      if (!already) {
        const obj = await storage().get(key);
        if (!obj) continue;
        await createPhotoFromUpload({ projectId: project.id, batchId: null, buffer: obj.body, originalName: key });
      }
      await storage().delete(key);
      imported++;
    } catch (e) {
      failed.push(`${key}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { imported, failed, projectId: project.id };
}
