import "server-only";
import { cookies } from "next/headers";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hmac, safeEqual } from "@/lib/crypto";
import type { SessionUser } from "@/lib/auth/session";
import type { Project } from "@/lib/photos";

const GALLERY_COOKIE_HOURS = 12;

function galleryCookieName(projectId: string) {
  return `gal_${projectId.replace(/-/g, "").slice(0, 16)}`;
}

/** Assinatura vincula projeto + validade + hash da senha atual (trocar a senha invalida acessos). */
function gallerySig(project: Pick<Project, "id" | "passwordHash">, exp: number) {
  return hmac(`gallery|${project.id}|${exp}|${(project.passwordHash ?? "").slice(-16)}`);
}

export async function grantGalleryCookie(project: Pick<Project, "id" | "passwordHash">, hours = GALLERY_COOKIE_HOURS) {
  const exp = Math.floor(Date.now() / 1000) + hours * 3600;
  (await cookies()).set(galleryCookieName(project.id), `${exp}.${gallerySig(project, exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: hours * 3600,
  });
}

async function hasGalleryCookie(project: Pick<Project, "id" | "passwordHash">) {
  const raw = (await cookies()).get(galleryCookieName(project.id))?.value;
  if (!raw) return false;
  const [expStr, sig] = raw.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() / 1000 || !sig) return false;
  return safeEqual(sig, gallerySig(project, exp));
}

/** Registro de acesso do cliente a um projeto (se existir e estiver válido). */
export async function clientAccess(projectId: string, user: SessionUser) {
  return db.query.projectAccess.findFirst({
    where: and(
      eq(schema.projectAccess.projectId, projectId),
      or(eq(schema.projectAccess.userId, user.id), sql`lower(${schema.projectAccess.email}) = lower(${user.email})`),
      or(isNull(schema.projectAccess.expiresAt), gt(schema.projectAccess.expiresAt, new Date())),
    ),
  });
}

export type ViewDecision =
  | { allowed: true; via: "public" | "admin" | "client" | "cookie" | "unlisted" }
  | { allowed: false; reason: "password" | "login" | "forbidden" | "unpublished" };

/** Regra única de visualização de projetos/galerias. */
export async function canViewProject(project: Project, user: SessionUser | null): Promise<ViewDecision> {
  if (user?.role === "admin") return { allowed: true, via: "admin" };
  if (!project.published) return { allowed: false, reason: "unpublished" };
  if (project.visibility === "public") return { allowed: true, via: "public" };
  if (project.visibility === "unlisted") return { allowed: true, via: "unlisted" };
  if (await hasGalleryCookie(project)) return { allowed: true, via: "cookie" };
  if (user && (await clientAccess(project.id, user))) return { allowed: true, via: "client" };
  if (project.visibility === "password") return { allowed: false, reason: "password" };
  return { allowed: false, reason: user ? "forbidden" : "login" };
}

/** IDs dos projetos liberados para o cliente (por conta ou e-mail), ainda válidos. */
export async function clientProjectIds(user: SessionUser) {
  const rows = await db
    .select({ projectId: schema.projectAccess.projectId })
    .from(schema.projectAccess)
    .where(
      and(
        or(eq(schema.projectAccess.userId, user.id), sql`lower(${schema.projectAccess.email}) = lower(${user.email})`),
        or(isNull(schema.projectAccess.expiresAt), gt(schema.projectAccess.expiresAt, new Date())),
      ),
    );
  return rows.map((r) => r.projectId);
}
