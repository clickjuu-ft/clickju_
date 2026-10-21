"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ipHash, sha256 } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import type { FormState } from "@/server/auth-actions";

export async function acceptProposal(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const ip = await clientIp();
  if (!(await rateLimit(`accept:${ipHash(ip) ?? "anon"}`, 10, 3600))) return { error: "Muitas tentativas. Tente mais tarde." };
  if (name.length < 3) return { error: "Digite seu nome completo para registrar o aceite." };
  if (fd.get("agree") !== "on") return { error: "Confirme que leu e concorda com a proposta." };
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.acceptTokenHash, sha256(token)) });
  if (!p || p.status !== "enviada") return { error: "Proposta indisponível para aceite." };
  if (p.validUntil < new Date().toISOString().slice(0, 10)) return { error: "Esta proposta expirou. Fale com a fotógrafa para uma nova versão." };
  await db
    .update(schema.proposals)
    .set({ status: "aceita", acceptedAt: new Date(), acceptedName: name.slice(0, 160), acceptedIpHash: ipHash(ip), updatedAt: new Date() })
    .where(and(eq(schema.proposals.id, p.id), eq(schema.proposals.status, "enviada")));
  await db.update(schema.quoteRequests).set({ status: "aprovado", updatedAt: new Date() }).where(eq(schema.quoteRequests.id, p.quoteId));
  await db.insert(schema.quoteEvents).values({ quoteId: p.quoteId, kind: "system", body: `Proposta ${p.number} aceita online por ${name}. Confirme a data com o cliente.` });
  await audit(null, "proposta.aceite_cliente", "proposal", p.id, { name });
  const s = await getSettings();
  await sendEmail({
    to: env.email.notifyTo ?? s.email,
    subject: `Proposta ${p.number} aceita`,
    html: emailLayout(s.brandName, "Proposta aceita", `<p>${escapeHtml(name)} aceitou a proposta ${p.number}.</p>`, {
      label: "Abrir pedido",
      url: `${env.appUrl}/admin/orcamentos/${p.quoteId}`,
    }),
    text: `${name} aceitou a proposta ${p.number}.`,
  });
  revalidatePath(`/proposta/${token}`);
  return { ok: true, message: "Aceite registrado! A fotógrafa entrará em contato para confirmar os próximos passos." };
}
