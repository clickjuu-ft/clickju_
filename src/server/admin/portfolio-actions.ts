"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { hashPassword, randomToken, sha256 } from "@/lib/crypto";
import { deletePhotos, regenerateVariants, searchTextFor } from "@/lib/photos";
import { slugify } from "@/lib/utils";
import { env } from "@/lib/env";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import type { FormState } from "@/server/auth-actions";

const STAGES = ["agendado", "em_producao", "em_edicao", "selecao_cliente", "finalizando", "entregue"] as const;

function revalidateProject(id: string, slug?: string) {
  revalidatePath("/admin/projetos");
  revalidatePath(`/admin/projetos/${id}`);
  revalidatePath("/portfolio");
  revalidatePath("/");
  if (slug) revalidatePath(`/portfolio/${slug}`);
}

async function uniqueSlug(base: string, exceptId?: string) {
  const root = slugify(base) || "projeto";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const hit = await db.query.projects.findFirst({ where: eq(schema.projects.slug, slug), columns: { id: true } });
    if (!hit || hit.id === exceptId) return slug;
  }
  return `${root}-${randomToken(3).toLowerCase()}`;
}

export async function createProject(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const title = String(fd.get("title") ?? "").trim();
  if (title.length < 2) return { error: "Informe o título." };
  const [p] = await db
    .insert(schema.projects)
    .values({ title: title.slice(0, 160), slug: await uniqueSlug(title), visibility: "public", published: false })
    .returning();
  await audit(admin.id, "projeto.criar", "project", p.id, { title });
  redirect(`/admin/projetos/${p.id}`);
}

const projectSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(80),
  summary: z.string().trim().max(400),
  description: z.string().trim().max(8000),
  categoryId: z.string().trim(),
  eventName: z.string().trim().max(160),
  eventDate: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida"),
  location: z.string().trim().max(200),
  visibility: z.enum(["public", "unlisted", "password", "private"]),
  password: z.string().max(200),
  clientStage: z.string(),
  deliveryInfo: z.string().trim().max(4000),
  deliveryDate: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida"),
  sort: z.coerce.number().int().min(0).max(100000),
});

export async function updateProject(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const current = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!current) return { error: "Projeto não encontrado." };
  const parsed = projectSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const d = parsed.data;
  if (d.visibility === "password" && !d.password && !current.passwordHash) {
    return { error: "Defina uma senha para galerias protegidas por senha." };
  }
  if (d.password && d.password.length < 6) return { error: "A senha da galeria precisa ter pelo menos 6 caracteres." };
  const watermark = fd.get("watermark") === "on";
  const slug = await uniqueSlug(d.slug || d.title, id);
  await db
    .update(schema.projects)
    .set({
      title: d.title,
      slug,
      summary: d.summary || null,
      description: d.description || null,
      categoryId: d.categoryId || null,
      eventName: d.eventName || null,
      eventDate: d.eventDate || null,
      location: d.location || null,
      visibility: d.visibility,
      passwordHash: d.visibility !== "password" ? null : d.password ? await hashPassword(d.password) : current.passwordHash,
      watermark,
      featured: fd.get("featured") === "on",
      published: fd.get("published") === "on",
      clientStage: (STAGES as readonly string[]).includes(d.clientStage) ? (d.clientStage as (typeof STAGES)[number]) : null,
      deliveryInfo: d.deliveryInfo || null,
      deliveryDate: d.deliveryDate || null,
      sort: d.sort,
      updatedAt: new Date(),
    })
    .where(eq(schema.projects.id, id));
  let note = "";
  if (watermark !== current.watermark) {
    const ids = (await db.query.photos.findMany({ where: eq(schema.photos.projectId, id), columns: { id: true } })).map((p) => p.id);
    const n = await regenerateVariants(ids);
    note = ` ${n} fotografias reprocessadas ${watermark ? "com" : "sem"} marca-d'água.`;
  }
  await audit(admin.id, "projeto.atualizar", "project", id, { visibility: d.visibility, watermark });
  revalidateProject(id, slug);
  return { ok: true, message: `Projeto salvo.${note}` };
}

export async function deleteProject(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!p) redirect("/admin/projetos");
  if (String(fd.get("confirm") ?? "").trim() !== p.title) redirect(`/admin/projetos/${id}?erro=confirmacao`);
  const ids = (await db.query.photos.findMany({ where: eq(schema.photos.projectId, id), columns: { id: true } })).map((x) => x.id);
  await deletePhotos(ids);
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  await audit(admin.id, "projeto.excluir", "project", id, { title: p.title, fotos: ids.length });
  revalidateProject(id, p.slug);
  redirect("/admin/projetos");
}

export async function createBatch(projectId: string, name: string) {
  await requireAdmin();
  const [b] = await db
    .insert(schema.uploadBatches)
    .values({ projectId, name: name.trim().slice(0, 120) || `Lote de ${new Date().toLocaleDateString("pt-BR")}` })
    .returning();
  return b.id;
}

export async function updatePhoto(input: { id: string; caption: string; alt: string; tags: string }) {
  const admin = await requireAdmin();
  const tags = [...new Set(input.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
  const caption = input.caption.trim().slice(0, 500) || null;
  const alt = input.alt.trim().slice(0, 300) || null;
  const [p] = await db
    .update(schema.photos)
    .set({ caption, alt, tags, searchText: searchTextFor({ caption, alt, tags }), updatedAt: new Date() })
    .where(eq(schema.photos.id, input.id))
    .returning({ projectId: schema.photos.projectId });
  await audit(admin.id, "foto.editar", "photo", input.id);
  if (p) revalidateProject(p.projectId);
  return { ok: true };
}

export async function reorderPhotos(projectId: string, ids: string[]) {
  const admin = await requireAdmin();
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx.update(schema.photos).set({ sort: i }).where(and(eq(schema.photos.id, id), eq(schema.photos.projectId, projectId)));
    }
  });
  await audit(admin.id, "foto.reordenar", "project", projectId, { n: ids.length });
  revalidateProject(projectId);
  return { ok: true };
}

export async function setCover(projectId: string, photoId: string) {
  const admin = await requireAdmin();
  await db.update(schema.projects).set({ coverPhotoId: photoId, updatedAt: new Date() }).where(eq(schema.projects.id, projectId));
  await audit(admin.id, "projeto.capa", "project", projectId, { photoId });
  revalidateProject(projectId);
  return { ok: true };
}

export async function removePhotos(projectId: string, ids: string[]) {
  const admin = await requireAdmin();
  const own = await db.query.photos.findMany({ where: and(inArray(schema.photos.id, ids), eq(schema.photos.projectId, projectId)), columns: { id: true } });
  await deletePhotos(own.map((p) => p.id));
  await audit(admin.id, "foto.excluir", "project", projectId, { n: own.length });
  revalidateProject(projectId);
  return { ok: true, removed: own.length };
}

export async function movePhotos(fromProjectId: string, ids: string[], toProjectId: string) {
  const admin = await requireAdmin();
  const target = await db.query.projects.findFirst({ where: eq(schema.projects.id, toProjectId) });
  if (!target) return { error: "Projeto de destino não encontrado." };
  const moved = await db
    .update(schema.photos)
    .set({ projectId: toProjectId, batchId: null, sort: sql`${schema.photos.sort} + 100000` })
    .where(and(inArray(schema.photos.id, ids), eq(schema.photos.projectId, fromProjectId)))
    .returning({ id: schema.photos.id });
  await db
    .update(schema.projects)
    .set({ coverPhotoId: null })
    .where(and(eq(schema.projects.id, fromProjectId), inArray(schema.projects.coverPhotoId, ids)));
  // a marca-d'água segue a configuração do projeto de destino
  await regenerateVariants(moved.map((m) => m.id));
  await audit(admin.id, "foto.mover", "project", fromProjectId, { para: toProjectId, n: moved.length });
  revalidateProject(fromProjectId);
  revalidateProject(toProjectId);
  return { ok: true, moved: moved.length };
}

/* ------------------------ compartilhamento e acessos ------------------------ */

export async function createShareLink(_prev: FormState & { link?: string }, fd: FormData): Promise<FormState & { link?: string }> {
  const admin = await requireAdmin();
  const projectId = String(fd.get("projectId"));
  const days = Number(fd.get("days") ?? 0);
  const token = randomToken(18);
  await db.insert(schema.shareLinks).values({
    projectId,
    tokenHash: sha256(token),
    label: String(fd.get("label") ?? "").trim().slice(0, 120) || null,
    expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
    createdBy: admin.id,
  });
  await audit(admin.id, "galeria.link_criado", "project", projectId, { days });
  revalidatePath(`/admin/projetos/${projectId}`);
  return { ok: true, message: "Link criado. Copie agora — por segurança ele não é exibido novamente.", link: `${env.appUrl}/g/${token}` };
}

export async function revokeShareLink(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const [l] = await db.update(schema.shareLinks).set({ revokedAt: new Date() }).where(eq(schema.shareLinks.id, id)).returning();
  await audit(admin.id, "galeria.link_revogado", "share_link", id);
  if (l) revalidatePath(`/admin/projetos/${l.projectId}`);
}

export async function grantAccess(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const projectId = String(fd.get("projectId"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "E-mail inválido." };
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) return { error: "Projeto não encontrado." };
  const user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  const days = Number(fd.get("days") ?? 0);
  const values = {
    projectId,
    email,
    userId: user?.id ?? null,
    canDownload: fd.get("canDownload") === "on",
    canShare: fd.get("canShare") === "on",
    invitedBy: admin.id,
    expiresAt: days > 0 ? new Date(Date.now() + days * 86400_000) : null,
  };
  const existing = await db.query.projectAccess.findFirst({
    where: and(eq(schema.projectAccess.projectId, projectId), sql`lower(${schema.projectAccess.email}) = ${email}`),
  });
  if (existing) await db.update(schema.projectAccess).set(values).where(eq(schema.projectAccess.id, existing.id));
  else await db.insert(schema.projectAccess).values(values);

  if (user) {
    await db.insert(schema.notifications).values({
      userId: user.id,
      title: "Nova galeria disponível",
      body: `Você recebeu acesso à galeria “${project.title}”.`,
      link: `/cliente/projetos/${project.id}`,
    });
  }
  const s = await getSettings();
  const url = user ? `${env.appUrl}/cliente/projetos/${project.id}` : `${env.appUrl}/cadastro`;
  const res = await sendEmail({
    to: email,
    subject: `Sua galeria “${project.title}” está disponível`,
    html: emailLayout(
      s.brandName,
      "Você recebeu acesso a uma galeria",
      `<p>A galeria <strong style="color:#fff">${escapeHtml(project.title)}</strong> foi liberada para você.</p><p>${
        user ? "Entre na Área do Cliente para visualizar." : "Crie sua conta usando este mesmo e-mail para visualizar."
      }</p>`,
      { label: user ? "Abrir galeria" : "Criar conta", url },
    ),
    text: `A galeria "${project.title}" foi liberada para você: ${url}`,
  });
  await audit(admin.id, "galeria.acesso_concedido", "project", projectId, { email, email_status: res.status });
  revalidatePath(`/admin/projetos/${projectId}`);
  return {
    ok: true,
    message: `Acesso liberado para ${email}.${res.status === "sent" ? " Convite enviado por e-mail." : " (E-mail não enviado: serviço não configurado — avise o cliente manualmente.)"}`,
  };
}

export async function revokeAccess(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const [a] = await db.delete(schema.projectAccess).where(eq(schema.projectAccess.id, id)).returning();
  if (a) {
    await audit(admin.id, "galeria.acesso_revogado", "project", a.projectId, { email: a.email });
    revalidatePath(`/admin/projetos/${a.projectId}`);
  }
}
