"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { clientAccess } from "@/lib/access";
import { audit } from "@/lib/audit";
import { verifyPassword } from "@/lib/crypto";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/server/auth-actions";

/** Garante que a foto pertence a um projeto ao qual o cliente tem acesso. */
async function authorizePhoto(photoId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessão expirada.");
  const photo = await db.query.photos.findFirst({ where: eq(schema.photos.id, photoId), columns: { id: true, projectId: true } });
  if (!photo) throw new Error("Foto não encontrada.");
  const access = user.role === "admin" ? true : await clientAccess(photo.projectId, user);
  if (!access) throw new Error("Sem acesso.");
  return { user, photo };
}

export async function toggleFavorite(photoId: string) {
  const { user, photo } = await authorizePhoto(photoId);
  const existing = await db.query.favorites.findFirst({ where: and(eq(schema.favorites.userId, user.id), eq(schema.favorites.photoId, photoId)) });
  if (existing) await db.delete(schema.favorites).where(and(eq(schema.favorites.userId, user.id), eq(schema.favorites.photoId, photoId)));
  else await db.insert(schema.favorites).values({ userId: user.id, photoId });
  revalidatePath(`/cliente/projetos/${photo.projectId}`);
  return { favorite: !existing };
}

export async function setApproval(photoId: string, status: "approved" | "rejected" | "none") {
  const { user, photo } = await authorizePhoto(photoId);
  if (status === "none") {
    await db.delete(schema.approvals).where(and(eq(schema.approvals.userId, user.id), eq(schema.approvals.photoId, photoId)));
  } else {
    await db
      .insert(schema.approvals)
      .values({ userId: user.id, photoId, status })
      .onConflictDoUpdate({ target: [schema.approvals.userId, schema.approvals.photoId], set: { status, updatedAt: new Date() } });
  }
  revalidatePath(`/cliente/projetos/${photo.projectId}`);
  return { status };
}

/** Envia a seleção à fotógrafa (e-mail + histórico). */
export async function submitSelection(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada." };
  const projectId = String(fd.get("projectId"));
  if (!(await clientAccess(projectId, user))) return { error: "Sem acesso." };
  if (!(await rateLimit(`selection:${user.id}:${projectId}`, 5, 3600))) return { error: "Aguarde antes de reenviar." };
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  const favs = await db
    .select({ name: schema.photos.originalName })
    .from(schema.favorites)
    .innerJoin(schema.photos, eq(schema.photos.id, schema.favorites.photoId))
    .where(and(eq(schema.favorites.userId, user.id), eq(schema.photos.projectId, projectId)));
  const approved = await db
    .select({ name: schema.photos.originalName })
    .from(schema.approvals)
    .innerJoin(schema.photos, eq(schema.photos.id, schema.approvals.photoId))
    .where(and(eq(schema.approvals.userId, user.id), eq(schema.approvals.status, "approved"), eq(schema.photos.projectId, projectId)));
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  const s = await getSettings();
  const res = await sendEmail({
    to: env.email.notifyTo ?? s.email,
    replyTo: user.email,
    subject: `Seleção enviada — ${project?.title} (${user.name})`,
    html: emailLayout(
      s.brandName,
      `${escapeHtml(user.name)} enviou a seleção`,
      `<p>Galeria: ${escapeHtml(project?.title ?? "")}</p><p>Favoritas: ${favs.length} · Aprovadas: ${approved.length}</p>${note ? `<p>Observação: ${escapeHtml(note)}</p>` : ""}<p style="font-size:12px;color:#A5A1B2">${approved.map((a) => escapeHtml(a.name)).join(", ")}</p>`,
      { label: "Abrir projeto", url: `${env.appUrl}/admin/projetos/${projectId}` },
    ),
    text: `${user.name} enviou a seleção de ${project?.title}: ${favs.length} favoritas, ${approved.length} aprovadas.\n${approved.map((a) => a.name).join("\n")}\n${note}`,
  });
  await audit(user.id, "cliente.selecao_enviada", "project", projectId, { favoritas: favs.length, aprovadas: approved.length, email: res.status });
  return {
    ok: true,
    message:
      res.status === "sent"
        ? "Seleção enviada! A fotógrafa foi notificada."
        : "Seleção registrada. A fotógrafa verá suas favoritas e aprovações no painel.",
  };
}

/** Compartilhamento controlado: convida outra pessoa somente para visualizar. */
export async function inviteViewer(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada." };
  const projectId = String(fd.get("projectId"));
  const access = await clientAccess(projectId, user);
  if (!access?.canShare) return { error: "Seu acesso não permite compartilhar esta galeria." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "E-mail inválido." };
  if (!(await rateLimit(`invite:${user.id}`, 10, 86400))) return { error: "Limite diário de convites atingido." };
  const existing = await db.query.projectAccess.findFirst({
    where: and(eq(schema.projectAccess.projectId, projectId), sql`lower(${schema.projectAccess.email}) = ${email}`),
  });
  if (existing) return { error: "Este e-mail já tem acesso." };
  const invited = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  await db.insert(schema.projectAccess).values({
    projectId,
    email,
    userId: invited?.id ?? null,
    canDownload: false,
    canShare: false,
    invitedBy: user.id,
    expiresAt: access.expiresAt,
  });
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  const s = await getSettings();
  if (invited) {
    await db.insert(schema.notifications).values({ userId: invited.id, title: "Nova galeria compartilhada", body: `${user.name} compartilhou “${project?.title}” com você.`, link: `/cliente/projetos/${projectId}` });
  }
  const res = await sendEmail({
    to: email,
    subject: `${user.name} compartilhou uma galeria com você`,
    html: emailLayout(s.brandName, "Galeria compartilhada", `<p>${escapeHtml(user.name)} compartilhou a galeria <strong style="color:#fff">${escapeHtml(project?.title ?? "")}</strong> com você (somente visualização).</p>`, {
      label: invited ? "Abrir galeria" : "Criar conta para ver",
      url: invited ? `${env.appUrl}/cliente/projetos/${projectId}` : `${env.appUrl}/cadastro`,
    }),
    text: `${user.name} compartilhou a galeria "${project?.title}" com você. Acesse ${env.appUrl}/cliente`,
  });
  await audit(user.id, "cliente.compartilhou", "project", projectId, { email, email_status: res.status });
  revalidatePath(`/cliente/projetos/${projectId}`);
  return { ok: true, message: `Acesso de visualização liberado para ${email}.${res.status === "sent" ? " Convite enviado." : " Avise a pessoa para criar a conta com este e-mail."}` };
}

export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
  revalidatePath("/cliente");
}

/** LGPD: o titular pode excluir a própria conta (favoritas, aprovações e sessões vão junto). */
export async function deleteMyAccount(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return { error: "Operação indisponível." };
  const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  if (!row || !(await verifyPassword(String(fd.get("password") ?? ""), row.passwordHash))) return { error: "Senha incorreta." };
  await audit(user.id, "cliente.conta_excluida", "user", user.id);
  await db.delete(schema.projectAccess).where(eq(schema.projectAccess.userId, user.id));
  await db.delete(schema.users).where(eq(schema.users.id, user.id));
  await destroySession();
  redirect("/?conta=excluida");
}
