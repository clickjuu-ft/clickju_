import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { QuoteAttachment } from "@/lib/db/schema";
import { hmac, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";
import { getQuoteOptions, getSettings, whatsappLink } from "@/lib/settings";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { fieldErrors, MAX_ATTACHMENT_MB, MAX_ATTACHMENTS, quoteSchema, type QuoteInput } from "@/lib/quotes/schema";

export class QuoteError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/* --------------------------- antispam ------------------------------- */

const MIN_FILL_SECONDS = 4;
const MAX_FORM_AGE_SECONDS = 60 * 60 * 24;

/** Token emitido quando o formulário é renderizado: comprova tempo mínimo de preenchimento. */
export function issueFormToken(now = Date.now()) {
  const t = Math.floor(now / 1000);
  return `${t}.${hmac(`quote-form|${t}`)}`;
}

export function checkFormToken(token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return "Formulário inválido. Recarregue a página.";
  const [tStr, sig] = token.split(".");
  const t = Number(tStr);
  if (!t || !sig || !safeEqual(sig, hmac(`quote-form|${t}`))) return "Formulário inválido. Recarregue a página.";
  const age = now / 1000 - t;
  if (age < MIN_FILL_SECONDS) return "Envio muito rápido. Revise os dados e tente novamente.";
  if (age > MAX_FORM_AGE_SECONDS) return "O formulário expirou. Recarregue a página para enviar.";
  return null;
}

/** Heurística simples de conteúdo: excesso de links é típico de spam. */
export function looksLikeSpam(input: Pick<QuoteInput, "description" | "extraInfo" | "specificNeeds">) {
  const text = [input.description, input.extraInfo, input.specificNeeds].filter(Boolean).join(" ");
  const links = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  return links > 3;
}

export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = env.turnstileSecret;
  if (!secret) return true; // não configurado: outras camadas continuam ativas
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

/* --------------------------- anexos --------------------------------- */

export type IncomingFile = { name: string; type: string; bytes: Buffer };

/** Identifica o tipo pelo conteúdo (assinatura binária), não pela extensão. */
export function sniffAttachment(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP")
    return { mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  const brand = buf.subarray(4, 12).toString("latin1");
  if (/^ftyp(heic|heix|mif1|msf1|hevc)/.test(brand)) return { mime: "image/heic", ext: "heic" };
  return null;
}

export function validateAttachments(files: IncomingFile[]) {
  const real = files.filter((f) => f.bytes.length > 0);
  if (real.length > MAX_ATTACHMENTS) throw new QuoteError(`Envie no máximo ${MAX_ATTACHMENTS} anexos.`, 400, { attachments: `Máximo de ${MAX_ATTACHMENTS} arquivos.` });
  return real.map((f) => {
    if (f.bytes.length > MAX_ATTACHMENT_MB * 1024 * 1024) {
      throw new QuoteError(`O arquivo “${f.name}” passa de ${MAX_ATTACHMENT_MB} MB.`, 400, { attachments: `Cada arquivo pode ter até ${MAX_ATTACHMENT_MB} MB.` });
    }
    const kind = sniffAttachment(f.bytes);
    if (!kind) throw new QuoteError(`Tipo de arquivo não aceito: “${f.name}”.`, 400, { attachments: "Aceitos: JPG, PNG, WebP, HEIC ou PDF." });
    return { ...f, ...kind, name: f.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || `anexo.${kind.ext}` };
  });
}

/* --------------------------- criação -------------------------------- */

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateQuoteCode(date = new Date()) {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `ORC-${date.getFullYear()}-${s}`;
}

/** Valida contra as opções cadastradas pela fotógrafa (o servidor não confia no navegador). */
async function validateAgainstCatalog(input: QuoteInput) {
  const opts = await getQuoteOptions();
  const fields: Record<string, string> = {};
  const services = await db
    .select({ slug: schema.services.slug })
    .from(schema.services)
    .where(and(eq(schema.services.active, true), inArray(schema.services.slug, input.services)));
  if (services.length !== new Set(input.services).size) fields.services = "Serviço inválido selecionado.";
  if (!opts.budgetRanges.includes(input.budgetRange)) fields.budgetRange = "Faixa de investimento inválida.";
  if (!opts.contactPreferences.includes(input.contactPreference)) fields.contactPreference = "Preferência de contato inválida.";
  if (input.photoCount && !opts.photoCounts.includes(input.photoCount)) fields.photoCount = "Opção inválida.";
  if (input.deadline && !opts.deadlines.includes(input.deadline)) fields.deadline = "Opção inválida.";
  if (input.duration && !opts.durations.includes(input.duration)) fields.duration = "Opção inválida.";
  if (input.addons.some((a) => !opts.addons.includes(a))) fields.addons = "Produto adicional inválido.";
  if (Object.keys(fields).length) throw new QuoteError("Alguns campos têm valores inválidos.", 400, fields);
}

export function parseQuote(raw: unknown): QuoteInput {
  const normalized =
    raw && typeof raw === "object"
      ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === "string" ? v.replace(/\r\n?/g, "\n") : v]))
      : raw;
  const parsed = quoteSchema.safeParse(normalized);
  if (!parsed.success) throw new QuoteError("Revise os campos destacados.", 400, fieldErrors(parsed.error));
  return parsed.data;
}

export type CreatedQuote = { id: string; code: string };

/**
 * Cria a solicitação. A gravação (registro + anexos) é atômica: se qualquer parte falhar,
 * nada é salvo e o erro é propagado — nunca há confirmação sem registro.
 */
export async function createQuote(
  raw: unknown,
  files: IncomingFile[],
  meta: { ipHash: string | null; userAgent: string | null; source?: string | null },
): Promise<CreatedQuote> {
  const input = parseQuote(raw);
  await validateAgainstCatalog(input);
  if (looksLikeSpam(input)) throw new QuoteError("Sua mensagem foi identificada como spam. Remova links e tente novamente.", 422);
  const attachments = validateAttachments(files);

  const written: string[] = [];
  try {
    const created = await db.transaction(async (tx) => {
      let code = generateQuoteCode();
      for (let i = 0; i < 5; i++) {
        const clash = await tx.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.code, code), columns: { id: true } });
        if (!clash) break;
        code = generateQuoteCode();
      }
      const [row] = await tx
        .insert(schema.quoteRequests)
        .values({
          code,
          name: input.name,
          email: input.email,
          whatsapp: input.whatsapp,
          city: input.city,
          state: input.state,
          contactPreference: input.contactPreference,
          services: input.services,
          eventDate: input.eventDate ?? null,
          altDate: input.altDate ?? null,
          location: input.location,
          duration: input.duration ?? null,
          participants: input.participants ?? null,
          description: input.description,
          specificNeeds: input.specificNeeds ?? null,
          budgetRange: input.budgetRange,
          photoCount: input.photoCount ?? null,
          deadline: input.deadline ?? null,
          addons: input.addons,
          extraInfo: input.extraInfo ?? null,
          status: "novo",
          consentAt: new Date(),
          ipHash: meta.ipHash,
          userAgent: meta.userAgent,
          source: meta.source?.slice(0, 120) ?? null,
        })
        .returning({ id: schema.quoteRequests.id, code: schema.quoteRequests.code });

      const stored: QuoteAttachment[] = [];
      for (const [i, f] of attachments.entries()) {
        const key = `attachments/${row.id}/${i + 1}.${f.ext}`;
        await storage().put(key, f.bytes, f.mime);
        written.push(key);
        stored.push({ key, name: f.name, mime: f.mime, bytes: f.bytes.length });
      }
      if (stored.length) {
        await tx.update(schema.quoteRequests).set({ attachments: stored }).where(eq(schema.quoteRequests.id, row.id));
      }
      await tx.insert(schema.quoteEvents).values({
        quoteId: row.id,
        kind: "system",
        body: `Solicitação recebida pelo site${meta.source ? ` (origem: ${meta.source})` : ""}.`,
      });
      return row;
    });
    return created;
  } catch (e) {
    await Promise.all(written.map((k) => storage().delete(k).catch(() => {})));
    throw e;
  }
}

/** Notificações pós-gravação. Falhas aqui não invalidam o pedido já salvo. */
export async function notifyQuote(quoteId: string) {
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, quoteId) });
  if (!q) return { notified: "skipped", confirmation: "skipped" } as const;
  const settings = await getSettings();
  const services = await db.query.services.findMany({ where: inArray(schema.services.slug, q.services) });
  const serviceNames = services.map((s) => s.name).join(", ");
  const adminUrl = `${env.appUrl}/admin/orcamentos/${q.id}`;

  const lines: [string, string | null | undefined][] = [
    ["Código", q.code],
    ["Cliente", q.name],
    ["E-mail", q.email],
    ["WhatsApp", q.whatsapp],
    ["Cidade", `${q.city}/${q.state}`],
    ["Contato preferido", q.contactPreference],
    ["Serviços", serviceNames],
    ["Data", q.eventDate],
    ["Data alternativa", q.altDate],
    ["Local", q.location],
    ["Investimento", q.budgetRange],
    ["Descrição", q.description],
  ];
  const table = lines
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#A5A1B2;vertical-align:top">${k}</td><td style="padding:4px 0">${escapeHtml(String(v))}</td></tr>`)
    .join("");

  const notifyTo = env.email.notifyTo ?? settings.email;
  const notified = await sendEmail({
    to: notifyTo,
    replyTo: q.email,
    subject: `Novo pedido de orçamento ${q.code} — ${q.name}`,
    html: emailLayout(settings.brandName, "Novo pedido de orçamento", `<table>${table}</table>`, { label: "Abrir no painel", url: adminUrl }),
    text: lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${adminUrl}`,
  });

  const wa = whatsappLink(settings.whatsapp, `Olá! Enviei a solicitação ${q.code} pelo site.`);
  const confirmation = await sendEmail({
    to: q.email,
    replyTo: settings.email,
    subject: `Recebemos sua solicitação ${q.code}`,
    html: emailLayout(
      settings.brandName,
      `Olá, ${q.name.split(" ")[0]}! Sua solicitação foi recebida.`,
      `<p>O código do seu pedido é <strong style="color:#fff">${q.code}</strong>. Vou analisar as informações e responder pessoalmente pelo canal de sua preferência (${escapeHtml(q.contactPreference)}).</p>
       <p>Valores e disponibilidade são confirmados somente na proposta enviada por mim.</p>
       <p style="color:#A5A1B2;font-size:13px">Você recebeu este e-mail porque enviou uma solicitação de orçamento em nosso site. Seus dados são tratados conforme a Política de Privacidade (${env.appUrl}/privacidade).</p>`,
      wa ? { label: "Falar pelo WhatsApp", url: wa } : undefined,
    ),
    text: `Olá, ${q.name}! Recebemos sua solicitação ${q.code}. Responderemos em breve.\n\nPolítica de privacidade: ${env.appUrl}/privacidade`,
  });

  await db
    .update(schema.quoteRequests)
    .set({
      notifiedAt: notified.status === "sent" ? new Date() : null,
      confirmationSentAt: confirmation.status === "sent" ? new Date() : null,
    })
    .where(eq(schema.quoteRequests.id, q.id));
  return { notified: notified.status, confirmation: confirmation.status };
}
