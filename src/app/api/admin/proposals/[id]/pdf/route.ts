import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth/session";
import { proposalPdf } from "@/lib/proposals/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/proposals/[id]/pdf">) {
  if (!(await adminOrNull())) return new NextResponse("Não autorizado", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const out = await proposalPdf(id);
  if (!out) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(out.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${out.number}.pdf"`, "Cache-Control": "no-store" },
  });
}
