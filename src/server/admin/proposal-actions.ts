"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { nextProposalNumber } from "@/lib/proposals/service";
import { formatBRL, formatDate } from "@/lib/utils";
import type { FormState } from "@/server/auth-actions";

/** Cria um rascunho a partir do pedido. Valores ficam em branco: quem define é a fotógrafa. */
export async function createProposalFromQuote(fd: FormData) {
  const admin = await requireAdmin();
  const quoteId = String(fd.get("quoteId"));
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, quoteId) });
  if (!q) redirect("/admin/orcamentos");
  const services = await db.query.services.findMany();
  const names = q.services.map((s) => services.find((x) => x.slug === s)?.name ?? s).join(", ");
  const valid = new Date(Date.now() + 15 * 86400_000).toISOString().slice(0, 10);
  const [p] = await db
    .insert(schema.proposals)
    .values({
      quoteId,
      number: await nextProposalNumber(),
      title: `${names} — ${q.name}`,
      scope: [q.description, q.location ? `Local: ${q.location}.` : "", q.duration ? `Duração estimada: ${q.duration}.` : ""].filter(Boolean).join("\n"),
      hours: q.duration,
      deliverables: q.photoCount ? `Aproximadamente ${q.photoCount} fotografias tratadas, entregues em galeria online privada.` : "Fotografias tratadas, entregues em galeria online privada.",
      deliveryDeadline: q.deadline ?? "",
      items: [],
      total: q.proposalValue ?? "0",
      paymentTerms: "",
      validUntil: q.validUntil ?? valid,
      conditions: null,
      status: "rascunho",
    })
    .returning();
  await db.insert(schema.quoteEvents).values({ quoteId, authorId: admin.id, kind: "system", body: `Rascunho de proposta ${p.number} criado.` });
  if (q.status === "novo" || q.status === "em_analise") {
    await db.update(schema.quoteRequests).set({ status: "preparando_proposta", updatedAt: new Date() }).where(eq(schema.quoteRequests.id, quoteId));
  }
  await audit(admin.id, "proposta.criar", "proposal", p.id, { quoteId });
  redirect(`/admin/propostas/${p.id}`);
}

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Valor inválido (use, por exemplo, 3500,00).")
  .transform(Number);

const proposalSchema = z.object({
  title: z.string().trim().min(3, "Informe o título.").max(200),
  scope: z.string().trim().min(10, "Descreva o escopo da cobertura.").max(6000),
  hours: z.string().trim().max(100),
  deliverables: z.string().trim().min(5, "Descreva os entregáveis.").max(4000),
  deliveryDeadline: z.string().trim().min(2, "Informe o prazo de entrega.").max(200),
  paymentTerms: z.string().trim().min(3, "Informe as condições de pagamento.").max(2000),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a validade."),
  conditions: z.string().trim().max(6000),
});

export async function saveProposal(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!p) return { error: "Proposta não encontrada." };
  if (p.status === "aceita") return { error: "Proposta já aceita pelo cliente não pode ser alterada. Crie uma nova versão." };
  const raw = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v.replace(/\r\n?/g, "\n") : v]));
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const descs = fd.getAll("itemDescription").map(String);
  const amounts = fd.getAll("itemAmount").map(String);
  const items: { description: string; amount: number }[] = [];
  for (let i = 0; i < descs.length; i++) {
    if (!descs[i].trim() && !amounts[i]?.trim()) continue;
    const a = money.safeParse(amounts[i] ?? "");
    if (!descs[i].trim() || !a.success) return { error: `Item ${i + 1}: informe descrição e valor válido.` };
    items.push({ description: descs[i].trim().slice(0, 300), amount: a.data });
  }
  let total: number;
  const manual = String(fd.get("total") ?? "").trim();
  if (manual) {
    const t = money.safeParse(manual);
    if (!t.success) return { error: "Valor total inválido." };
    total = t.data;
  } else {
    total = items.reduce((s, i) => s + i.amount, 0);
  }
  if (!(total > 0)) return { error: "Defina o valor total (ou os itens) da proposta." };

  await db
    .update(schema.proposals)
    .set({ ...parsed.data, conditions: parsed.data.conditions || null, hours: parsed.data.hours || null, items, total: total.toFixed(2), updatedAt: new Date() })
    .where(eq(schema.proposals.id, id));
  await db
    .update(schema.quoteRequests)
    .set({ proposalValue: total.toFixed(2), validUntil: parsed.data.validUntil, updatedAt: new Date() })
    .where(eq(schema.quoteRequests.id, p.quoteId));
  await audit(admin.id, "proposta.salvar", "proposal", id, { total });
  revalidatePath(`/admin/propostas/${id}`);
  return { ok: true, message: "Proposta salva." };
}

/**
 * Marca como enviada e gera um novo link de aceite (o anterior deixa de valer).
 * O link é exibido uma única vez na tela e, se o e-mail estiver configurado, enviado ao cliente.
 */
export async function sendProposal(_prev: FormState, fd: FormData): Promise<FormState & { link?: string }> {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!p) return { error: "Proposta não encontrada." };
  if (!(Number(p.total) > 0) || !p.paymentTerms) return { error: "Salve a proposta com valor e condições de pagamento antes de enviar." };
  if (p.status === "aceita") return { error: "Esta proposta já foi aceita." };
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, p.quoteId) });
  if (!q) return { error: "Pedido não encontrado." };
  const token = randomToken(24);
  await db
    .update(schema.proposals)
    .set({ status: "enviada", sentAt: new Date(), acceptTokenHash: sha256(token), updatedAt: new Date() })
    .where(eq(schema.proposals.id, id));
  await db.update(schema.quoteRequests).set({ status: "proposta_enviada", updatedAt: new Date() }).where(eq(schema.quoteRequests.id, q.id));
  const link = `${env.appUrl}/proposta/${token}`;
  let emailNote = "";
  if (fd.get("email") === "on") {
    const s = await getSettings();
    const res = await sendEmail({
      to: q.email,
      replyTo: s.email,
      subject: `Proposta ${p.number} — ${s.brandName}`,
      html: emailLayout(
        s.brandName,
        `Olá, ${q.name.split(" ")[0]}! Sua proposta está pronta.`,
        `<p>${escapeHtml(p.title)}</p><p>Valor total: <strong style="color:#fff">${formatBRL(p.total)}</strong><br>Válida até ${formatDate(p.validUntil)}.</p><p>Você pode ver todos os detalhes, baixar o PDF e aceitar online pelo link abaixo.</p>`,
        { label: "Ver proposta", url: link },
      ),
      text: `Sua proposta ${p.number} está disponível em: ${link}`,
    });
    emailNote = res.status === "sent" ? " E-mail enviado ao cliente." : " O e-mail NÃO foi enviado (serviço não configurado ou falhou) — envie o link manualmente.";
  }
  await db.insert(schema.quoteEvents).values({ quoteId: q.id, authorId: admin.id, kind: "system", body: `Proposta ${p.number} enviada.${emailNote}` });
  await audit(admin.id, "proposta.enviar", "proposal", id);
  revalidatePath(`/admin/propostas/${id}`);
  return { ok: true, message: `Proposta marcada como enviada.${emailNote}`, link };
}

export async function setProposalStatus(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["rascunho", "recusada"].includes(status)) return;
  await db.update(schema.proposals).set({ status, acceptTokenHash: status === "recusada" ? null : undefined, updatedAt: new Date() }).where(eq(schema.proposals.id, id));
  await audit(admin.id, `proposta.${status}`, "proposal", id);
  revalidatePath(`/admin/propostas/${id}`);
}
