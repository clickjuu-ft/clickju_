import { NextResponse } from "next/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { grantGalleryCookie } from "@/lib/access";
import { env } from "@/lib/env";

/** Link de compartilhamento: valida o token, concede acesso temporário e redireciona para a galeria. */
export async function GET(_req: Request, ctx: RouteContext<"/g/[token]">) {
  const { token } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new NextResponse("Link inválido", { status: 404 });
  const link = await db.query.shareLinks.findFirst({
    where: and(
      eq(schema.shareLinks.tokenHash, sha256(token)),
      isNull(schema.shareLinks.revokedAt),
      or(isNull(schema.shareLinks.expiresAt), gt(schema.shareLinks.expiresAt, new Date())),
    ),
  });
  if (!link) return new NextResponse("Este link expirou ou foi revogado.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, link.projectId) });
  if (!project || !project.published) return new NextResponse("Galeria indisponível.", { status: 404 });
  const hours = link.expiresAt ? Math.max(1, Math.min(72, (link.expiresAt.getTime() - Date.now()) / 3600_000)) : 72;
  await grantGalleryCookie(project, hours);
  return NextResponse.redirect(new URL(`/portfolio/${project.slug}`, env.appUrl));
}
