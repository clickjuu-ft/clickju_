"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { aiEnabled, AI_MODEL } from "@/lib/ai/claude";
import { describePhoto, type PhotoMetadata } from "@/lib/ai/vision";
import { embeddingsEnabled, embedPhoto } from "@/lib/ai/embeddings";
import { runImageTool, LOCAL_TOOLS, REMOTE_TOOLS, type ToolName } from "@/lib/ai/image-tools";
import { searchTextFor } from "@/lib/photos";
import type { FormState } from "@/server/auth-actions";

const back = (projectId: string, extra = "") => `/admin/ia?projeto=${projectId}${extra}`;

/** Analisa até N fotos ainda sem sugestão. Resultado fica pendente de revisão. */
export async function analyzeProject(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!aiEnabled()) return { error: "IA não configurada. Defina ANTHROPIC_API_KEY (veja o README)." };
  const projectId = String(fd.get("projectId"));
  const limit = Math.min(20, Math.max(1, Number(fd.get("limit") ?? 10)));
  const todo = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.projectId, projectId),
        notExists(db.select({ x: sql`1` }).from(schema.aiSuggestions).where(eq(schema.aiSuggestions.photoId, schema.photos.id))),
      ),
    )
    .orderBy(asc(schema.photos.sort))
    .limit(limit);
  const categories = await db.query.categories.findMany({ columns: { slug: true, name: true } });
  let ok = 0;
  const errors: string[] = [];
  for (const { id } of todo) {
    try {
      const meta = await describePhoto(id, categories);
      await db.insert(schema.aiSuggestions).values({ photoId: id, kind: "metadata", model: AI_MODEL(), payload: meta });
      ok++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      if (errors.length >= 3) break;
    }
  }
  await audit(admin.id, "ia.analisar", "project", projectId, { ok, erros: errors.length });
  revalidatePath("/admin/ia");
  if (!todo.length) return { ok: true, message: "Todas as fotos deste projeto já foram analisadas." };
  return errors.length
    ? { error: `${ok} analisadas; ${errors.length} falharam: ${errors[0]}` }
    : { ok: true, message: `${ok} fotografias analisadas. Revise as sugestões abaixo antes de aplicar.` };
}

/** Revisão humana: aceitar (com eventuais edições) ou rejeitar. */
export async function reviewSuggestion(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const decision = fd.get("decision") === "accept" ? "accepted" : "rejected";
  const s = await db.query.aiSuggestions.findFirst({ where: eq(schema.aiSuggestions.id, id) });
  if (!s || s.status !== "pending") return;
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, s.photoId) });
  if (!photo) return;
  if (decision === "accepted") {
    const caption = String(fd.get("caption") ?? "").trim().slice(0, 500) || null;
    const alt = String(fd.get("alt") ?? "").trim().slice(0, 300) || null;
    const tags = [...new Set(String(fd.get("tags") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
    await db
      .update(schema.photos)
      .set({ caption, alt, tags, searchText: searchTextFor({ caption, alt, tags }), updatedAt: new Date() })
      .where(eq(schema.photos.id, photo.id));
    if (fd.get("applyCategory") === "on") {
      const slug = (s.payload as PhotoMetadata).category_slug;
      const cat = slug ? await db.query.categories.findFirst({ where: eq(schema.categories.slug, slug) }) : null;
      if (cat) await db.update(schema.projects).set({ categoryId: cat.id }).where(eq(schema.projects.id, photo.projectId));
    }
  }
  await db.update(schema.aiSuggestions).set({ status: decision, reviewedBy: admin.id, reviewedAt: new Date() }).where(eq(schema.aiSuggestions.id, id));
  await audit(admin.id, `ia.sugestao_${decision === "accepted" ? "aceita" : "rejeitada"}`, "photo", photo.id);
  revalidatePath("/admin/ia");
  revalidatePath(`/admin/projetos/${photo.projectId}`);
}

export async function embedProject(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!embeddingsEnabled()) return { error: "Busca semântica por imagem não configurada (VOYAGE_API_KEY)." };
  const projectId = String(fd.get("projectId"));
  const todo = await db.query.photos.findMany({ where: and(eq(schema.photos.projectId, projectId), isNull(schema.photos.embedding)), columns: { id: true }, limit: 50 });
  let ok = 0;
  try {
    for (const p of todo) {
      await embedPhoto(p.id);
      ok++;
    }
  } catch (e) {
    return { error: `${ok} indexadas; falha: ${e instanceof Error ? e.message : e}` };
  }
  await audit(admin.id, "ia.indexar", "project", projectId, { ok });
  revalidatePath("/admin/ia");
  return { ok: true, message: `${ok} fotografias indexadas para busca semântica.` };
}

export async function createCollection(fd: FormData) {
  const admin = await requireAdmin();
  const projectId = String(fd.get("projectId"));
  const name = String(fd.get("name") ?? "").trim().slice(0, 120) || "Seleção";
  const ids = fd.getAll("photoIds").map(String);
  const valid = ids.length
    ? (await db.query.photos.findMany({ where: and(inArray(schema.photos.id, ids), eq(schema.photos.projectId, projectId)), columns: { id: true } })).map((p) => p.id)
    : [];
  const ordered = ids.filter((i) => valid.includes(i));
  const [c] = await db.insert(schema.collections).values({ projectId, name, photoIds: ordered, createdBy: admin.id }).returning();
  await audit(admin.id, "colecao.criar", "collection", c.id, { n: ordered.length });
  redirect(back(projectId, "#colecoes"));
}

export async function deleteCollection(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const [c] = await db.delete(schema.collections).where(eq(schema.collections.id, id)).returning();
  await audit(admin.id, "colecao.excluir", "collection", id);
  if (c?.projectId) redirect(back(c.projectId, "#colecoes"));
}

/** Aplica a ordem confirmada: na coleção e, opcionalmente, na galeria publicada. */
export async function applySequence(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("collectionId"));
  const order = String(fd.get("order") ?? "").split(",").filter(Boolean);
  const c = await db.query.collections.findFirst({ where: eq(schema.collections.id, id) });
  if (!c || !c.projectId) return;
  const valid = order.filter((x) => c.photoIds.includes(x));
  await db.update(schema.collections).set({ photoIds: valid, updatedAt: new Date() }).where(eq(schema.collections.id, id));
  if (fd.get("applyToGallery") === "on") {
    // fotos da coleção primeiro, na ordem sugerida; as demais mantêm a ordem relativa
    const all = await db.query.photos.findMany({ where: eq(schema.photos.projectId, c.projectId), orderBy: [asc(schema.photos.sort)], columns: { id: true } });
    const rest = all.map((p) => p.id).filter((x) => !valid.includes(x));
    const final = [...valid, ...rest];
    await db.transaction(async (tx) => {
      for (const [i, pid] of final.entries()) await tx.update(schema.photos).set({ sort: i }).where(eq(schema.photos.id, pid));
    });
  }
  await audit(admin.id, "colecao.sequencia_aplicada", "collection", id, { galeria: fd.get("applyToGallery") === "on" });
  revalidatePath(`/admin/projetos/${c.projectId}`);
  redirect(back(c.projectId, "#colecoes"));
}

export async function runTool(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const photoId = String(fd.get("photoId"));
  const tool = String(fd.get("tool")) as ToolName;
  if (!(tool in LOCAL_TOOLS) && !(tool in REMOTE_TOOLS)) return { error: "Ferramenta inválida." };
  const r = await runImageTool(photoId, tool);
  await audit(admin.id, "imagem.ferramenta", "photo", photoId, { tool, ok: r.ok });
  revalidatePath("/admin/ia");
  return r.ok ? { ok: true, message: "Arquivo gerado (o original foi preservado). Veja em “Arquivos gerados”." } : { error: r.error };
}
