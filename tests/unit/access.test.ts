import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { canViewProject, clientProjectIds, grantGalleryCookie } from "@/lib/access";
import { hashPassword } from "@/lib/crypto";
import { clearCookies } from "./setup";
import { makeUser } from "./helpers";

type P = typeof schema.projects.$inferSelect;
let pub: P, priv: P, pwd: P, draft: P;
let admin: Awaited<ReturnType<typeof makeUser>>, client: Awaited<ReturnType<typeof makeUser>>, other: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  const mk = async (slug: string, visibility: P["visibility"], published = true, passwordHash: string | null = null) =>
    (await db.insert(schema.projects).values({ slug: `${slug}-${Date.now()}`, title: slug, visibility, published, passwordHash }).returning())[0];
  pub = await mk("publico", "public");
  priv = await mk("privado", "private");
  pwd = await mk("senha", "password", true, await hashPassword("segredo123"));
  draft = await mk("rascunho", "public", false);
  admin = await makeUser(`admin-${Date.now()}@t.com`, "admin");
  client = await makeUser(`cliente-${Date.now()}@t.com`);
  other = await makeUser(`outro-${Date.now()}@t.com`);
  // convite por e-mail (antes de vincular a conta) também deve valer
  await db.insert(schema.projectAccess).values({ projectId: priv.id, email: client.email.toUpperCase(), canDownload: true });
  // acesso expirado não vale
  await db.insert(schema.projectAccess).values({ projectId: pwd.id, email: other.email, userId: other.id, expiresAt: new Date(Date.now() - 1000) });
});

beforeEach(() => clearCookies());

describe("regras de acesso às galerias", () => {
  it("público visível para todos; rascunho somente admin", async () => {
    expect((await canViewProject(pub, null)).allowed).toBe(true);
    expect(await canViewProject(draft, null)).toEqual({ allowed: false, reason: "unpublished" });
    expect((await canViewProject(draft, admin)).allowed).toBe(true);
  });

  it("privado: anônimo precisa entrar; outro cliente é bloqueado; cliente autorizado vê", async () => {
    expect(await canViewProject(priv, null)).toEqual({ allowed: false, reason: "login" });
    expect(await canViewProject(priv, other)).toEqual({ allowed: false, reason: "forbidden" });
    expect(await canViewProject(priv, client)).toEqual({ allowed: true, via: "client" });
    expect((await canViewProject(priv, admin)).allowed).toBe(true);
  });

  it("senha: bloqueado até desbloquear; acesso expirado não vale", async () => {
    expect(await canViewProject(pwd, null)).toEqual({ allowed: false, reason: "password" });
    expect(await canViewProject(pwd, other)).toEqual({ allowed: false, reason: "password" });
    await grantGalleryCookie(pwd);
    expect(await canViewProject(pwd, null)).toEqual({ allowed: true, via: "cookie" });
  });

  it("cookie de galeria não vale para outro projeto e cai ao trocar a senha", async () => {
    await grantGalleryCookie(pwd);
    expect((await canViewProject(priv, null)).allowed).toBe(false);
    const changed = { ...pwd, passwordHash: await hashPassword("nova-senha") };
    expect((await canViewProject(changed, null)).allowed).toBe(false);
  });

  it("cliente vê somente os próprios projetos", async () => {
    expect(await clientProjectIds(client)).toEqual([priv.id]);
    expect(await clientProjectIds(other)).toEqual([]);
  });
});
