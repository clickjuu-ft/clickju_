import { NextResponse } from "next/server";
import { after } from "next/server";
import { ipHash } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, sameOrigin } from "@/lib/request";
import { checkFormToken, createQuote, notifyQuote, QuoteError, verifyTurnstile, type IncomingFile } from "@/lib/quotes/service";

const MAX_BODY = 60 * 1024 * 1024;

/** Recebe a solicitação de orçamento (multipart/form-data). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return NextResponse.json({ error: "Envio muito grande. Reduza os anexos." }, { status: 413 });

  const ip = await clientIp();
  const ipH = ipHash(ip);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o formulário." }, { status: 400 });
  }

  // 1) honeypot: campo invisível que pessoas não preenchem
  if (String(form.get("website") ?? "").trim() !== "") {
    return NextResponse.json({ error: "Envio bloqueado pela proteção contra spam." }, { status: 422 });
  }
  // 2) tempo mínimo de preenchimento (token assinado)
  const tokenError = checkFormToken(String(form.get("formToken") ?? ""));
  if (tokenError) return NextResponse.json({ error: tokenError }, { status: 422 });
  // 3) limite por IP
  if (!(await rateLimit(`quote:${ipH ?? "anon"}`, 5, 3600))) {
    return NextResponse.json({ error: "Muitas solicitações em pouco tempo. Tente novamente mais tarde ou fale pelo WhatsApp." }, { status: 429 });
  }
  // 4) Cloudflare Turnstile (se configurado)
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return NextResponse.json({ error: "Falha na verificação anti-robô. Tente novamente." }, { status: 422 });
  }

  const raw = {
    name: form.get("name"),
    email: form.get("email"),
    whatsapp: form.get("whatsapp"),
    city: form.get("city"),
    state: form.get("state"),
    contactPreference: form.get("contactPreference"),
    services: form.getAll("services").map(String),
    eventDate: form.get("eventDate") || undefined,
    altDate: form.get("altDate") || undefined,
    location: form.get("location"),
    duration: form.get("duration") || undefined,
    participants: form.get("participants") || undefined,
    description: form.get("description"),
    specificNeeds: form.get("specificNeeds") || undefined,
    budgetRange: form.get("budgetRange"),
    photoCount: form.get("photoCount") || undefined,
    deadline: form.get("deadline") || undefined,
    addons: form.getAll("addons").map(String),
    extraInfo: form.get("extraInfo") || undefined,
    consent: form.get("consent") === "true",
  };

  const files: IncomingFile[] = [];
  for (const f of form.getAll("attachments")) {
    if (f instanceof File && f.size > 0) files.push({ name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) });
  }

  try {
    const created = await createQuote(raw, files, {
      ipHash: ipH,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      source: typeof form.get("source") === "string" ? String(form.get("source")) : null,
    });
    // e-mails após a resposta; o pedido já está salvo
    after(() => notifyQuote(created.id).catch((e) => console.error("[quote] notificação falhou", e)));
    return NextResponse.json({ ok: true, code: created.code }, { status: 201 });
  } catch (e) {
    if (e instanceof QuoteError) return NextResponse.json({ error: e.message, fields: e.fields }, { status: e.status });
    console.error("[quote] erro ao salvar", e);
    return NextResponse.json({ error: "Não foi possível registrar sua solicitação agora. Nada foi enviado — tente novamente." }, { status: 500 });
  }
}
