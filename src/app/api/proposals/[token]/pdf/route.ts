import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { proposalPdf } from "@/lib/proposals/service";

/** PDF para o cliente, acessível somente com o token secreto do link de aceite. */
export async function GET(_req: Request, ctx: RouteContext<"/api/proposals/[token]/pdf">) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new NextResponse("Não encontrado", { status: 404 });
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.acceptTokenHash, sha256(token)), columns: { id: true } });
  if (!p) return new NextResponse("Não encontrado", { status: 404 });
  const out = await proposalPdf(p.id, token);
  if (!out) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(out.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${out.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
