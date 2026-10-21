import { NextResponse } from "next/server";
import { z } from "zod";
import { ipHash } from "@/lib/crypto";
import { clientIp, sameOrigin } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { chat } from "@/lib/ai/chat";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(20),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const ip = ipHash(await clientIp()) ?? "anon";
  if (!(await rateLimit(`chat:${ip}`, 30, 3600))) {
    return NextResponse.json({ error: "Muitas mensagens em pouco tempo. Tente novamente mais tarde ou use o formulário de orçamento." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages[parsed.data.messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 });
  }
  try {
    return NextResponse.json(await chat(parsed.data.messages));
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ error: "O assistente está indisponível no momento. Use o formulário de orçamento ou o WhatsApp." }, { status: 503 });
  }
}
