import "server-only";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type EmailResult = { status: "sent" | "skipped" | "failed"; provider?: string; error?: string };

export function emailConfigured() {
  return !!env.email.from && (!!env.email.resendKey || !!env.email.smtpUrl);
}

/**
 * Envia e-mail via Resend (RESEND_API_KEY) ou SMTP (SMTP_URL).
 * Sem configuração, NÃO finge envio: registra como "skipped" e retorna esse status.
 */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  let result: EmailResult;
  if (!emailConfigured()) {
    result = { status: "skipped", error: "Serviço de e-mail não configurado" };
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:não enviado] para=${msg.to} assunto="${msg.subject}"\n${msg.text}\n`);
    }
  } else if (env.email.resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.email.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.email.from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          reply_to: msg.replyTo,
        }),
      });
      result = res.ok
        ? { status: "sent", provider: "resend" }
        : { status: "failed", provider: "resend", error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
    } catch (e) {
      result = { status: "failed", provider: "resend", error: String(e).slice(0, 300) };
    }
  } else {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(env.email.smtpUrl!);
      await transport.sendMail({ from: env.email.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: msg.replyTo });
      result = { status: "sent", provider: "smtp" };
    } catch (e) {
      result = { status: "failed", provider: "smtp", error: String(e).slice(0, 300) };
    }
  }
  try {
    await db.insert(schema.emailLog).values({ to: msg.to, subject: msg.subject, status: result.status, provider: result.provider, error: result.error });
  } catch {
    /* log é melhor esforço */
  }
  if (result.status === "failed") console.error("[email] falha:", result.error);
  return result;
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

/** Layout de e-mail com a identidade preto/roxo/branco. */
export function emailLayout(brand: string, title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#09090D;font-family:Arial,Helvetica,sans-serif;color:#F4F1FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090D;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15131C;border:1px solid #2a2635">
<tr><td style="padding:28px 32px;border-bottom:1px solid #2a2635"><span style="font-size:18px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#fff">${esc(brand)}</span><span style="display:inline-block;width:6px;height:6px;background:#8B5CF6;border-radius:50%;margin-left:6px"></span></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#fff">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#d9d5e3">${bodyHtml}</div>
${cta ? `<p style="margin:28px 0 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#8B5CF6;color:#fff;text-decoration:none;padding:14px 22px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #2a2635;font-size:12px;color:#A5A1B2">Mensagem automática enviada por ${esc(brand)}.</td></tr>
</table></td></tr></table></body></html>`;
}

export { esc as escapeHtml };
