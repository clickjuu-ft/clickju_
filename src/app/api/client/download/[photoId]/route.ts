import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { clientAccess } from "@/lib/access";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";

/** Download do arquivo original — somente para clientes com permissão de download nesse projeto. */
export async function GET(_req: Request, ctx: RouteContext<"/api/client/download/[photoId]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.appUrl));
  const { photoId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(photoId)) return new NextResponse("Não encontrado", { status: 404 });
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
  if (!photo) return new NextResponse("Não encontrado", { status: 404 });
  if (user.role !== "admin") {
    const access = await clientAccess(photo.projectId, user);
    if (!access?.canDownload) return new NextResponse("Download não liberado para esta galeria.", { status: 403 });
  }
  await audit(user.id, "cliente.download", "photo", photo.id, { projectId: photo.projectId });
  const url = await storage().signedUrl(photo.originalKey, { access: "private", download: photo.originalName });
  return NextResponse.redirect(new URL(url, env.appUrl), { headers: { "Cache-Control": "no-store" } });
}
