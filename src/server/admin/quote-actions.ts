"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { storage } from "@/lib/storage";
import { QUOTE_STATUSES, statusLabel, type QuoteStatus } from "@/lib/quotes/schema";
import type { FormState } from "@/server/auth-actions";

const statusEnum = z.enum(QUOTE_STATUSES.map((s) => s.value) as [QuoteStatus, ...QuoteStatus[]]);

async function addEvent(quoteId: string, authorId: string, kind: string, body: string, channel?: string | null) {
  await db.insert(schema.quoteEvents).values({ quoteId, authorId, kind, body, channel: channel ?? null });
}

export async function setQuoteStatus(quoteId: string, status: string) {
  const admin = await requireAdmin();
  const parsed = statusEnum.safeParse(status);
  if (!parsed.success) return { error: "Status inválido." };
  const current = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, quoteId) });
  if (!current) return { error: "Pedido não encontrado." };
  if (current.status === parsed.data) return { ok: true };
  await db.update(schema.quoteRequests).set({ status: parsed.data, updatedAt: new Date() }).where(eq(schema.quoteRequests.id, quoteId));
  await addEvent(quoteId, admin.id, "status", `Status: ${statusLabel(current.status)} → ${statusLabel(parsed.data)}`);
  await audit(admin.id, "orcamento.status", "quote", quoteId, { de: current.status, para: parsed.data });
  revalidatePath("/admin/orcamentos");
  revalidatePath(`/admin/orcamentos/${quoteId}`);
  return { ok: true };
}

export async function setQuoteStatusForm(fd: FormData) {
  await setQuoteStatus(String(fd.get("quoteId")), String(fd.get("status")));
}

export async function addQuoteNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  const kind = fd.get("kind") === "contact" ? "contact" : "note";
  const body = String(fd.get("body") ?? "").trim();
  const channel = String(fd.get("channel") ?? "").trim() || null;
  if (body.length < 2) return { error: "Escreva a observação." };
  if (body.length > 5000) return { error: "Texto muito longo." };
  await addEvent(quoteId, admin.id, kind, body, kind === "contact" ? channel : null);
  await audit(admin.id, kind === "contact" ? "orcamento.contato" : "orcamento.nota", "quote", quoteId);
  revalidatePath(`/admin/orcamentos/${quoteId}`);
  return { ok: true, message: kind === "contact" ? "Contato registrado." : "Observação salva." };
}

const commercialSchema = z.object({
  proposalValue: z
    .string()
    .trim()
    .transform((v) => (v ? v.replace(/\./g, "").replace(",", ".") : ""))
    .refine((v) => v === "" || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) < 100_000_000), "Valor inválido (ex.: 3500,00)."),
  validUntil: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida."),
  outcome: z.string().trim().max(2000),
});

export async function saveQuoteCommercial(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  const parsed = commercialSchema.safeParse({
    proposalValue: String(fd.get("proposalValue") ?? ""),
    validUntil: String(fd.get("validUntil") ?? ""),
    outcome: String(fd.get("outcome") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { proposalValue, validUntil, outcome } = parsed.data;
  await db
    .update(schema.quoteRequests)
    .set({ proposalValue: proposalValue || null, validUntil: validUntil || null, outcome: outcome || null, updatedAt: new Date() })
    .where(eq(schema.quoteRequests.id, quoteId));
  await addEvent(quoteId, admin.id, "system", `Dados comerciais atualizados${proposalValue ? ` (valor R$ ${proposalValue})` : ""}.`);
  await audit(admin.id, "orcamento.comercial", "quote", quoteId, { proposalValue, validUntil });
  revalidatePath(`/admin/orcamentos/${quoteId}`);
  return { ok: true, message: "Salvo." };
}

export async function addReminder(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  const dueAt = String(fd.get("dueAt") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueAt)) return { error: "Informe data e hora." };
  if (!note) return { error: "Descreva o lembrete." };
  await db.insert(schema.quoteReminders).values({ quoteId, dueAt: new Date(`${dueAt}:00-03:00`), note: note.slice(0, 500), createdBy: admin.id });
  await audit(admin.id, "orcamento.lembrete", "quote", quoteId);
  revalidatePath(`/admin/orcamentos/${quoteId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Lembrete agendado." };
}

export async function toggleReminder(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const r = await db.query.quoteReminders.findFirst({ where: eq(schema.quoteReminders.id, id) });
  if (!r) return;
  await db.update(schema.quoteReminders).set({ doneAt: r.doneAt ? null : new Date() }).where(eq(schema.quoteReminders.id, id));
  await audit(admin.id, "orcamento.lembrete_concluido", "quote", r.quoteId);
  revalidatePath(`/admin/orcamentos/${r.quoteId}`);
  revalidatePath("/admin");
}

export async function setArchived(fd: FormData) {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  const archived = fd.get("archived") === "1";
  await db.update(schema.quoteRequests).set({ archived, updatedAt: new Date() }).where(eq(schema.quoteRequests.id, quoteId));
  await addEvent(quoteId, admin.id, "system", archived ? "Pedido arquivado." : "Pedido desarquivado.");
  await audit(admin.id, archived ? "orcamento.arquivar" : "orcamento.desarquivar", "quote", quoteId);
  revalidatePath(`/admin/orcamentos/${quoteId}`);
  revalidatePath("/admin/orcamentos");
}

/** LGPD: remove dados pessoais mantendo o registro estatístico. Irreversível. */
export async function anonymizeQuote(fd: FormData) {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  if (fd.get("confirm") !== "ANONIMIZAR") redirect(`/admin/orcamentos/${quoteId}?erro=confirmacao`);
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, quoteId) });
  if (!q) return;
  await Promise.all(q.attachments.map((a) => storage().delete(a.key).catch(() => {})));
  await db
    .update(schema.quoteRequests)
    .set({
      name: "Titular anonimizado",
      email: `anonimizado+${q.code.toLowerCase()}@invalido.local`,
      whatsapp: "00000000000",
      city: "—",
      description: "[conteúdo removido a pedido do titular / política de retenção]",
      specificNeeds: null,
      extraInfo: null,
      location: null,
      attachments: [],
      ipHash: null,
      userAgent: null,
      anonymizedAt: new Date(),
      archived: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.quoteRequests.id, quoteId));
  await db.update(schema.quoteEvents).set({ body: "[removido]" }).where(and(eq(schema.quoteEvents.quoteId, quoteId), sql`${schema.quoteEvents.kind} in ('note','contact')`));
  await addEvent(quoteId, admin.id, "system", "Dados pessoais anonimizados (LGPD).");
  await audit(admin.id, "orcamento.anonimizar", "quote", quoteId);
  revalidatePath(`/admin/orcamentos/${quoteId}`);
}
