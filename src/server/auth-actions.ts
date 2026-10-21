"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { hashPassword, ipHash, randomToken, sha256, verifyPassword } from "@/lib/crypto";
import { createSession, destroyAllSessions, destroySession, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, userAgent } from "@/lib/request";
import { audit } from "@/lib/audit";
import { emailLayout, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";

export type FormState = { error?: string; fields?: Record<string, string>; ok?: boolean; message?: string };

const passwordRule = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .max(200)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números.");

function safeNext(next: unknown, fallback: string) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : fallback;
}

// hash fixo para equalizar o tempo de resposta quando o e-mail não existe
let dummyHash: string | null = null;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = ipHash(await clientIp()) ?? "anon";
  if (!(await rateLimit(`login:ip:${ip}`, 20, 900)) || !(await rateLimit(`login:email:${email}`, 8, 900))) {
    return { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." };
  }
  const user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  dummyHash ??= await hashPassword("senha-inexistente-0");
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok || user.disabled) {
    await audit(user?.id ?? null, "login.falha", "user", user?.id, { email });
    return { error: "E-mail ou senha incorretos." };
  }
  await createSession(user.id, await userAgent());
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit(user.id, "login.sucesso", "user", user.id);
  redirect(safeNext(fd.get("next"), user.role === "admin" ? "/admin" : "/cliente"));
}

export async function logout() {
  const u = await getCurrentUser();
  await destroySession();
  if (u) await audit(u.id, "logout", "user", u.id);
  redirect("/");
}

const registerSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  phone: z.string().trim().max(30).optional(),
  password: passwordRule,
  consent: z.literal("on", { error: "É necessário aceitar os termos e a política de privacidade." }),
});

/** Cadastro de clientes. Acesso a galerias depende de liberação pela fotógrafa. */
export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = ipHash(await clientIp()) ?? "anon";
  if (!(await rateLimit(`register:${ip}`, 5, 3600))) return { error: "Muitas tentativas. Tente mais tarde." };
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { error: "Revise os campos.", fields };
  }
  const { name, email, phone, password } = parsed.data;
  const exists = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  if (exists) return { error: "Já existe uma conta com este e-mail. Entre ou recupere a senha." };
  const [user] = await db
    .insert(schema.users)
    .values({ name, email, phone: phone || null, role: "client", passwordHash: await hashPassword(password) })
    .returning();
  // vincula convites de galeria enviados para este e-mail
  await db
    .update(schema.projectAccess)
    .set({ userId: user.id })
    .where(and(sql`lower(${schema.projectAccess.email}) = ${email}`, isNull(schema.projectAccess.userId)));
  await audit(user.id, "cadastro", "user", user.id);
  await createSession(user.id, await userAgent());
  redirect("/cliente");
}

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = ipHash(await clientIp()) ?? "anon";
  const generic: FormState = {
    ok: true,
    message: "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha. Verifique sua caixa de entrada.",
  };
  if (!(await rateLimit(`reset:${ip}`, 5, 3600)) || !(await rateLimit(`reset:${email}`, 3, 3600))) return generic;
  const user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  if (!user || user.disabled) return generic; // não revela se o e-mail existe
  const token = randomToken(32);
  await db.insert(schema.passwordResets).values({ id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3600_000) });
  const url = `${env.appUrl}/redefinir-senha?token=${token}`;
  const s = await getSettings();
  const res = await sendEmail({
    to: user.email,
    subject: "Redefinição de senha",
    html: emailLayout(s.brandName, "Redefinir sua senha", "<p>Recebemos um pedido para redefinir sua senha. O link é válido por 1 hora. Se não foi você, ignore este e-mail.</p>", {
      label: "Criar nova senha",
      url,
    }),
    text: `Para redefinir sua senha, acesse (válido por 1 hora): ${url}`,
  });
  if (res.status === "skipped" && process.env.NODE_ENV !== "production") console.info(`[dev] link de redefinição: ${url}`);
  await audit(user.id, "senha.pedido_redefinicao", "user", user.id, { email: res.status });
  return generic;
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const pw = passwordRule.safeParse(fd.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  if (fd.get("password") !== fd.get("confirm")) return { error: "As senhas não conferem." };
  const row = await db.query.passwordResets.findFirst({
    where: and(eq(schema.passwordResets.id, sha256(token)), isNull(schema.passwordResets.usedAt), gt(schema.passwordResets.expiresAt, new Date())),
  });
  if (!row) return { error: "Link inválido ou expirado. Solicite um novo." };
  await db.update(schema.users).set({ passwordHash: await hashPassword(pw.data), updatedAt: new Date() }).where(eq(schema.users.id, row.userId));
  await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, row.id));
  await destroyAllSessions(row.userId); // encerra sessões antigas
  await audit(row.userId, "senha.redefinida", "user", row.userId);
  return { ok: true, message: "Senha alterada. Você já pode entrar com a nova senha." };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sessão expirada." };
  const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  if (!row || !(await verifyPassword(String(fd.get("current") ?? ""), row.passwordHash))) return { error: "Senha atual incorreta." };
  const pw = passwordRule.safeParse(fd.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  await db.update(schema.users).set({ passwordHash: await hashPassword(pw.data) }).where(eq(schema.users.id, user.id));
  await audit(user.id, "senha.alterada", "user", user.id);
  return { ok: true, message: "Senha alterada." };
}
