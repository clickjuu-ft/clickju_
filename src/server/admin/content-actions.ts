"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { getQuoteOptions, getSettings, saveSetting, type QuoteOptions, type SiteSettings } from "@/lib/settings";
import { storage } from "@/lib/storage";
import { inspect, extForFormat, mimeForFormat, regenerateVariantsSafe } from "@/lib/images/admin-helpers";
import type { FormState } from "@/server/auth-actions";

const str = (fd: FormData, k: string, max = 4000) => String(fd.get(k) ?? "").trim().slice(0, max);
const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const int = (fd: FormData, k: string) => Math.max(0, Math.min(100000, Number(fd.get(k) ?? 0) || 0));

function done(paths: string[], message = "Salvo."): FormState {
  for (const p of paths) revalidatePath(p);
  return { ok: true, message };
}

/* ------------------------------ categorias ------------------------------ */

export async function saveCategory(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name", 80);
  if (name.length < 2) return { error: "Informe o nome." };
  const values = { name, slug: slugify(str(fd, "slug", 80) || name), description: str(fd, "description", 400) || null, sort: int(fd, "sort"), updatedAt: new Date() };
  try {
    if (id) await db.update(schema.categories).set(values).where(eq(schema.categories.id, id));
    else await db.insert(schema.categories).values(values);
  } catch {
    return { error: "Já existe uma categoria com este endereço (slug)." };
  }
  await audit(admin.id, id ? "categoria.editar" : "categoria.criar", "category", id || null, { name });
  return done(["/admin/categorias", "/portfolio", "/"]);
}

export async function deleteCategory(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  await audit(admin.id, "categoria.excluir", "category", id);
  revalidatePath("/admin/categorias");
}

/* ------------------------------- serviços ------------------------------- */

export async function saveService(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name", 80);
  if (name.length < 2) return { error: "Informe o nome." };
  const priceRaw = str(fd, "priceFrom", 20).replace(/\./g, "").replace(",", ".");
  if (priceRaw && !/^\d+(\.\d{1,2})?$/.test(priceRaw)) return { error: "Preço inválido." };
  const values = {
    name,
    slug: slugify(str(fd, "slug", 80) || name),
    description: str(fd, "description", 600) || null,
    coverage: str(fd, "coverage", 3000) || null,
    priceFrom: priceRaw || null,
    priceNote: str(fd, "priceNote", 300) || null,
    showPrice: bool(fd, "showPrice") && !!priceRaw,
    active: bool(fd, "active"),
    sort: int(fd, "sort"),
    updatedAt: new Date(),
  };
  try {
    if (id) await db.update(schema.services).set(values).where(eq(schema.services.id, id));
    else await db.insert(schema.services).values(values);
  } catch {
    return { error: "Já existe um serviço com este endereço (slug)." };
  }
  await audit(admin.id, id ? "servico.editar" : "servico.criar", "service", id || null, { name, priceFrom: priceRaw || null });
  return done(["/admin/servicos", "/servicos", "/orcamento"]);
}

export async function deleteService(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  // pedidos antigos guardam o slug; desativar preserva o histórico legível
  await db.update(schema.services).set({ active: false }).where(eq(schema.services.id, id));
  await audit(admin.id, "servico.desativar", "service", id);
  revalidatePath("/admin/servicos");
}

/* ------------------------------ depoimentos ------------------------------ */

export async function saveTestimonial(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const author = str(fd, "author", 120);
  const quote = str(fd, "quote", 1200);
  if (!author || quote.length < 10) return { error: "Informe autor e depoimento." };
  if (!bool(fd, "authorized")) return { error: "Confirme que o depoimento é real e que você tem autorização para publicá-lo." };
  const values = { author, quote, context: str(fd, "context", 160) || null, published: bool(fd, "published"), sort: int(fd, "sort"), updatedAt: new Date() };
  if (id) await db.update(schema.testimonials).set(values).where(eq(schema.testimonials.id, id));
  else await db.insert(schema.testimonials).values(values);
  await audit(admin.id, id ? "depoimento.editar" : "depoimento.criar", "testimonial", id || null, { author });
  return done(["/admin/depoimentos", "/"]);
}

export async function deleteTestimonial(fd: FormData) {
  const admin = await requireAdmin();
  await db.delete(schema.testimonials).where(eq(schema.testimonials.id, str(fd, "id")));
  await audit(admin.id, "depoimento.excluir", "testimonial", str(fd, "id"));
  revalidatePath("/admin/depoimentos");
  revalidatePath("/");
}

/* ---------------------------- base de conhecimento ---------------------------- */

export async function saveKnowledge(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title", 160);
  const content = str(fd, "content", 6000);
  if (!title || content.length < 10) return { error: "Informe título e conteúdo." };
  const values = { title, content, published: bool(fd, "published"), updatedAt: new Date() };
  if (id) await db.update(schema.knowledgeBase).set(values).where(eq(schema.knowledgeBase.id, id));
  else await db.insert(schema.knowledgeBase).values(values);
  await audit(admin.id, id ? "conhecimento.editar" : "conhecimento.criar", "knowledge", id || null, { title });
  return done(["/admin/conhecimento"]);
}

export async function deleteKnowledge(fd: FormData) {
  const admin = await requireAdmin();
  await db.delete(schema.knowledgeBase).where(eq(schema.knowledgeBase.id, str(fd, "id")));
  await audit(admin.id, "conhecimento.excluir", "knowledge", str(fd, "id"));
  revalidatePath("/admin/conhecimento");
}

/* ---------------------------------- blog ---------------------------------- */

export async function savePost(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const title = str(fd, "title", 200);
  const body = str(fd, "body", 50000);
  if (title.length < 3 || body.length < 20) return { error: "Informe título e conteúdo." };
  const published = bool(fd, "published");
  const existing = id ? await db.query.blogPosts.findFirst({ where: eq(schema.blogPosts.id, id) }) : null;
  const values = {
    title,
    slug: slugify(str(fd, "slug", 80) || title),
    excerpt: str(fd, "excerpt", 400) || null,
    body,
    coverPhotoId: str(fd, "coverPhotoId") || null,
    published,
    publishedAt: published ? (existing?.publishedAt ?? new Date()) : null,
    updatedAt: new Date(),
  };
  try {
    if (id) await db.update(schema.blogPosts).set(values).where(eq(schema.blogPosts.id, id));
    else await db.insert(schema.blogPosts).values(values);
  } catch {
    return { error: "Já existe um post com este endereço (slug)." };
  }
  await audit(admin.id, id ? "blog.editar" : "blog.criar", "post", id || null, { title });
  return done(["/admin/blog", "/blog", `/blog/${values.slug}`]);
}

export async function deletePost(fd: FormData) {
  const admin = await requireAdmin();
  await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, str(fd, "id")));
  await audit(admin.id, "blog.excluir", "post", str(fd, "id"));
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

/* ------------------------------ configurações ------------------------------ */

const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 40);

export async function saveSiteSettings(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const cur = await getSettings();
  const email = str(fd, "email", 160);
  if (email && !z.email().safeParse(email).success) return { error: "E-mail de contato inválido." };
  const whatsapp = str(fd, "whatsapp", 30).replace(/\D/g, "");
  if (whatsapp && (whatsapp.length < 12 || whatsapp.length > 13)) return { error: "WhatsApp: use DDI + DDD + número, ex.: 5521912345678." };
  const opacity = Number(fd.get("wmOpacity"));
  const scale = Number(fd.get("wmScale"));
  const socials = lines(str(fd, "socials", 3000))
    .map((l) => {
      const [label, url] = l.split("|").map((s) => s.trim());
      return { label, url };
    })
    .filter((s) => s.label && /^https:\/\//.test(s.url ?? ""));
  const next: SiteSettings = {
    ...cur,
    brandName: str(fd, "brandName", 80) || cur.brandName,
    tagline: str(fd, "tagline", 160),
    heroEyebrow: str(fd, "heroEyebrow", 80),
    heroTitle: str(fd, "heroTitle", 120),
    heroAccent: str(fd, "heroAccent", 120),
    heroText: str(fd, "heroText", 400),
    heroPhotoId: str(fd, "heroPhotoId") || null,
    heroMobilePhotoId: str(fd, "heroMobilePhotoId") || null,
    aboutTitle: str(fd, "aboutTitle", 120),
    aboutText: str(fd, "aboutText", 6000),
    aboutPhotoId: str(fd, "aboutPhotoId") || null,
    baseCity: str(fd, "baseCity", 120),
    email,
    whatsapp,
    instagram: str(fd, "instagram", 60).replace(/^@/, ""),
    socials,
    ctaTitle: str(fd, "ctaTitle", 160),
    ctaText: str(fd, "ctaText", 400),
    privacyContact: str(fd, "privacyContact", 160),
    retentionMonths: Math.max(6, Math.min(120, Number(fd.get("retentionMonths")) || 24)),
    seoDescription: str(fd, "seoDescription", 300),
    watermark: {
      enabled: bool(fd, "wmEnabled"),
      text: str(fd, "wmText", 60) || `© ${cur.brandName}`,
      opacity: Number.isFinite(opacity) ? Math.max(0.05, Math.min(0.6, opacity)) : cur.watermark.opacity,
      position: (["center", "bottom-right", "bottom-left", "tiled"] as const).includes(fd.get("wmPosition") as "center")
        ? (fd.get("wmPosition") as SiteSettings["watermark"]["position"])
        : cur.watermark.position,
      scale: Number.isFinite(scale) ? Math.max(0.1, Math.min(0.6, scale)) : cur.watermark.scale,
    },
  };
  await saveSetting("site", next);
  const wmChanged = JSON.stringify(next.watermark) !== JSON.stringify(cur.watermark);
  let note = "";
  if (wmChanged) {
    const n = await regenerateVariantsSafe();
    note = n ? ` Marca-d’água reaplicada em ${n} fotografias de projetos com marca-d’água.` : "";
  }
  await audit(admin.id, "configuracoes.site", "settings", "site", { wmChanged });
  return done(["/", "/admin/configuracoes", "/sobre", "/contato", "/orcamento"], `Configurações salvas.${note}`);
}

export async function saveQuoteOptions(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const cur = await getQuoteOptions();
  const next: QuoteOptions = {
    budgetRanges: lines(str(fd, "budgetRanges")),
    photoCounts: lines(str(fd, "photoCounts")),
    deadlines: lines(str(fd, "deadlines")),
    addons: lines(str(fd, "addons")),
    durations: lines(str(fd, "durations")),
    contactPreferences: lines(str(fd, "contactPreferences")),
  };
  if (!next.budgetRanges.length || !next.contactPreferences.length) return { error: "Faixas de investimento e preferências de contato não podem ficar vazias." };
  if (!next.budgetRanges.some((b) => /não defini/i.test(b))) next.budgetRanges.push("Ainda não defini");
  await saveSetting("quote_options", { ...cur, ...next });
  await audit(admin.id, "configuracoes.orcamento", "settings", "quote_options");
  return done(["/orcamento", "/admin/configuracoes"], "Opções do formulário salvas.");
}

/** Upload das logos oficiais (SVG ou PNG/WebP). SVG é aceito somente com conteúdo seguro. */
export async function uploadLogo(_p: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const slot = str(fd, "slot") as "logoOnDarkKey" | "logoOnLightKey" | "logoAccentKey";
  if (!["logoOnDarkKey", "logoOnLightKey", "logoAccentKey"].includes(slot)) return { error: "Variação inválida." };
  const cur = await getSettings();
  if (fd.get("remove") === "1") {
    if (cur[slot]) await storage().delete(cur[slot]!).catch(() => {});
    await saveSetting("site", { ...cur, [slot]: null });
    return done(["/", "/admin/configuracoes"], "Logo removida — usando a marca recriada.");
  }
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo." };
  if (file.size > 3 * 1024 * 1024) return { error: "A logo deve ter até 3 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  let key: string;
  const head = buf.subarray(0, 512).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    const text = buf.toString("utf8");
    if (/<script|on\w+\s*=|javascript:|<foreignObject|xlink:href\s*=\s*["']https?:/i.test(text)) {
      return { error: "SVG com conteúdo ativo não é permitido. Exporte o SVG sem scripts." };
    }
    key = `brand/${slot}-${Date.now()}.svg`;
    await storage().put(key, buf, "image/svg+xml");
  } else {
    try {
      const meta = await inspect(buf);
      key = `brand/${slot}-${Date.now()}.${extForFormat(meta.format!)}`;
      await storage().put(key, buf, mimeForFormat(meta.format!));
    } catch {
      return { error: "Envie SVG, PNG ou WebP." };
    }
  }
  if (cur[slot]) await storage().delete(cur[slot]!).catch(() => {});
  await saveSetting("site", { ...cur, [slot]: key });
  await audit(admin.id, "configuracoes.logo", "settings", slot);
  return done(["/", "/admin/configuracoes"], "Logo atualizada.");
}

/* -------------------------------- clientes -------------------------------- */

export async function setUserDisabled(fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  if (id === admin.id) return;
  const disabled = fd.get("disabled") === "1";
  await db.update(schema.users).set({ disabled }).where(eq(schema.users.id, id));
  if (disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
  await audit(admin.id, disabled ? "usuario.desativar" : "usuario.reativar", "user", id);
  revalidatePath("/admin/clientes");
}
