/**
 * Importa fotografias enviadas diretamente na raiz do bucket (ex.: pelo painel do Supabase).
 * Cada imagem é processada como um upload normal (original preservado + variantes) e
 * colocada no projeto "Fotos importadas" (rascunho). O arquivo solto é removido depois.
 *
 *   npm run import:bucket
 * Em produção roda na inicialização quando IMPORT_BUCKET_ROOT=true.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { createPhotoFromUpload } from "@/lib/photos";

const IMAGE = /\.(jpe?g|png|webp|tiff?|heic|heif|avif)$/i;

async function main() {
  const keys = (await storage().listRoot()).filter((k) => IMAGE.test(k));
  if (!keys.length) {
    console.log("Nenhuma foto solta no bucket para importar.");
    process.exit(0);
  }
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
  const [batch] = await db.insert(schema.uploadBatches).values({ projectId: project.id, name: `Importação ${new Date().toLocaleDateString("pt-BR")}` }).returning();
  console.log(`→ Importando ${keys.length} foto(s) para "${project.title}" (rascunho)`);
  let ok = 0;
  for (const key of keys.sort()) {
    try {
      const obj = await storage().get(key);
      if (!obj) continue;
      await createPhotoFromUpload({ projectId: project.id, batchId: batch.id, buffer: obj.body, originalName: key, alt: null, caption: null });
      await storage().delete(key);
      ok++;
      console.log(`  ✓ ${key}`);
    } catch (e) {
      console.error(`  ✗ ${key}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`✓ ${ok} de ${keys.length} importadas`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
