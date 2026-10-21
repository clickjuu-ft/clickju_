"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { verifyPassword, ipHash } from "@/lib/crypto";
import { grantGalleryCookie } from "@/lib/access";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";

export type UnlockState = { error?: string; ok?: boolean };

export async function unlockGallery(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const projectId = String(formData.get("projectId") ?? "");
  const password = String(formData.get("password") ?? "");
  const ip = ipHash(await clientIp()) ?? "anon";
  if (!(await rateLimit(`unlock:${ip}:${projectId}`, 8, 900))) {
    return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  }
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project || project.visibility !== "password" || !project.passwordHash) return { error: "Galeria indisponível." };
  if (!(await verifyPassword(password, project.passwordHash))) return { error: "Senha incorreta." };
  await grantGalleryCookie(project);
  return { ok: true };
}
