import { NextResponse } from "next/server";
import { storage, assertKey } from "@/lib/storage";
import { verifySignedPayload } from "@/lib/crypto";

/** Entrega arquivos do driver local mediante URL assinada e com validade. */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  const url = new URL(req.url);
  const e = Number(url.searchParams.get("e"));
  const s = url.searchParams.get("s") ?? "";
  const dl = url.searchParams.get("dl") ?? "";
  const a = url.searchParams.get("a") === "p" ? "p" : "r";
  try {
    assertKey(key);
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  if (!verifySignedPayload(`${key}|${dl}|${a}`, e, s)) {
    return new NextResponse("Link expirado ou inválido", { status: 403 });
  }
  const obj = await storage().get(key);
  if (!obj) return new NextResponse("Não encontrado", { status: 404 });
  const maxAge = Math.max(0, e - Math.floor(Date.now() / 1000) - 60);
  const headers: Record<string, string> = {
    "Content-Type": obj.contentType,
    "Content-Length": String(obj.body.length),
    "Cache-Control": `${a === "p" ? "public" : "private"}, max-age=${maxAge}, immutable`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  };
  if (dl) headers["Content-Disposition"] = `attachment; filename="${dl.replace(/["\\\r\n]/g, "")}"`;
  return new NextResponse(new Uint8Array(obj.body), { headers });
}
