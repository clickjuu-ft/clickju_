import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { adminOrNull } from "@/lib/auth/session";

/** Lista de seleção (favoritas/aprovações por cliente + coleções da fotógrafa) em CSV. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/projects/[id]/selection">) {
  if (!(await adminOrNull())) return new NextResponse("Não autorizado", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const photos = await db.query.photos.findMany({ where: eq(schema.photos.projectId, id) });
  const ids = photos.map((p) => p.id);
  if (!ids.length) return new NextResponse("Sem fotografias", { status: 404 });
  const [favs, apprs, users, collections] = await Promise.all([
    db.query.favorites.findMany({ where: inArray(schema.favorites.photoId, ids) }),
    db.query.approvals.findMany({ where: inArray(schema.approvals.photoId, ids) }),
    db.query.users.findMany({ columns: { id: true, name: true, email: true } }),
    db.query.collections.findMany({ where: and(eq(schema.collections.projectId, id)) }),
  ]);
  const name = (uid: string) => users.find((u) => u.id === uid);
  const rows = photos.map((p) => {
    const f = favs.filter((x) => x.photoId === p.id).map((x) => name(x.userId)?.email).filter(Boolean);
    const a = apprs.filter((x) => x.photoId === p.id && x.status === "approved").map((x) => name(x.userId)?.email).filter(Boolean);
    const c = collections.filter((x) => x.photoIds.includes(p.id)).map((x) => x.name);
    return [p.originalName, p.sort + 1, f.join("; "), a.join("; "), c.join("; "), p.qualityScore ?? ""];
  });
  const cell = (v: unknown) => `"${String(v).replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"`;
  const csv = "﻿" + [["arquivo", "ordem", "favorita_de", "aprovada_por", "colecoes", "nota_tecnica"], ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="selecao-${id.slice(0, 8)}.csv"`, "Cache-Control": "no-store" },
  });
}
