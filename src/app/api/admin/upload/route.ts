import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { adminOrNull } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/request";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { createPhotoFromUpload, toView } from "@/lib/photos";
import { ImageValidationError } from "@/lib/images/process";

export const maxDuration = 120;

/** Upload de UMA fotografia por requisição (o painel envia os arquivos do lote em sequência). */
export async function POST(req: Request) {
  const admin = await adminOrNull();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  const maxBytes = env.uploadMaxMb * 1024 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes + 1024 * 64) {
    return NextResponse.json({ error: `Arquivo acima de ${env.uploadMaxMb} MB.` }, { status: 413 });
  }
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  const file = fd.get("file");
  const projectId = String(fd.get("projectId") ?? "");
  const batchId = String(fd.get("batchId") ?? "") || null;
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Nenhum arquivo." }, { status: 400 });
  if (file.size > maxBytes) return NextResponse.json({ error: `Arquivo acima de ${env.uploadMaxMb} MB.` }, { status: 413 });
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId), columns: { id: true } });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  try {
    const photo = await createPhotoFromUpload({
      projectId,
      batchId,
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
    });
    await audit(admin.id, "foto.upload", "photo", photo.id, { projectId, nome: file.name, bytes: file.size });
    return NextResponse.json({ ok: true, photo: await toView(photo, "private") }, { status: 201 });
  } catch (e) {
    if (e instanceof ImageValidationError) return NextResponse.json({ error: e.message }, { status: 415 });
    console.error("[upload]", e);
    return NextResponse.json({ error: "Falha ao processar a imagem." }, { status: 500 });
  }
}
