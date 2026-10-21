"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { ipHash } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { checkFormToken } from "@/lib/quotes/service";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import type { FormState } from "@/server/auth-actions";

const Contact = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, "Escreva uma mensagem (mín. 10 caracteres).").max(4000),
});

export async function sendContact(_p: FormState, fd: FormData): Promise<FormState> {
  if (String(fd.get("website") ?? "") !== "") return { error: "Envio bloqueado." };
  const tokenErr = checkFormToken(String(fd.get("formToken") ?? ""));
  if (tokenErr) return { error: tokenErr };
  const ip = ipHash(await clientIp());
  if (!(await rateLimit(`contact:${ip ?? "anon"}`, 5, 3600))) return { error: "Muitas mensagens. Tente mais tarde." };
  if (fd.get("consent") !== "on") return { error: "É necessário concordar com o tratamento dos dados." };
  const parsed = Contact.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  // grava primeiro: a confirmação só aparece se o registro existir
  await db.insert(schema.contactMessages).values({ ...d, phone: d.phone || null, consentAt: new Date(), ipHash: ip });
  const s = await getSettings();
  await sendEmail({
    to: env.email.notifyTo ?? s.email,
    replyTo: d.email,
    subject: `Nova mensagem pelo site — ${d.name}`,
    html: emailLayout(s.brandName, "Nova mensagem de contato", `<p><strong>${escapeHtml(d.name)}</strong> (${escapeHtml(d.email)}${d.phone ? `, ${escapeHtml(d.phone)}` : ""})</p><p style="white-space:pre-line">${escapeHtml(d.message)}</p>`, {
      label: "Ver no painel",
      url: `${env.appUrl}/admin/mensagens`,
    }),
    text: `${d.name} <${d.email}> ${d.phone ?? ""}\n\n${d.message}`,
  });
  return { ok: true, message: "Mensagem recebida! Respondo o quanto antes." };
}
