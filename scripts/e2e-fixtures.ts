/**
 * Prepara o banco de testes ponta a ponta (E2E_DATABASE_URL) com dados conhecidos.
 * NUNCA aponte para o banco de produção: o esquema é recriado.
 */
import { writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import sharp from "sharp";

async function main() {
  const url = process.env.DATABASE_URL!;
  if (!/e2e|test/.test(url)) throw new Error("DATABASE_URL deve ser um banco de testes (e2e/test).");
  const raw = postgres(url, { max: 1, onnotice: () => {} });
  await raw`drop schema if exists public cascade`;
  await raw`drop schema if exists drizzle cascade`;
  await raw`create schema public`;
  await migrate(drizzle(raw), { migrationsFolder: "./drizzle" });
  await raw.end();

  const { db, schema } = await import("@/lib/db");
  const { hashPassword } = await import("@/lib/crypto");
  const { createPhotoFromUpload } = await import("@/lib/photos");
  const { saveSetting, DEFAULT_SETTINGS, DEFAULT_QUOTE_OPTIONS } = await import("@/lib/settings");

  await saveSetting("site", { ...DEFAULT_SETTINGS, whatsapp: "5521965947941" });
  await saveSetting("quote_options", DEFAULT_QUOTE_OPTIONS);
  await db.insert(schema.services).values([
    { slug: "fotografia-esportiva", name: "Fotografia esportiva", sort: 0 },
    { slug: "festas-e-eventos", name: "Festas e eventos", sort: 1 },
  ]);
  const [cat] = await db.insert(schema.categories).values({ slug: "eventos", name: "Eventos" }).returning();
  const pw = await hashPassword("Senha-e2e-123");
  const [admin] = await db.insert(schema.users).values({ email: "admin@e2e.test", name: "Admin E2E", role: "admin", passwordHash: pw }).returning();
  const [client] = await db.insert(schema.users).values({ email: "cliente@e2e.test", name: "Cliente Autorizado", role: "client", passwordHash: pw }).returning();
  await db.insert(schema.users).values({ email: "intruso@e2e.test", name: "Cliente Sem Acesso", role: "client", passwordHash: pw });

  const img = (color: string) =>
    sharp({ create: { width: 1600, height: 1067, channels: 3, background: color } })
      .composite([{ input: Buffer.from(`<svg width="1600" height="1067"><rect x="500" y="300" width="600" height="467" fill="#fff"/></svg>`) }])
      .jpeg()
      .toBuffer();
  const mk = async (slug: string, title: string, visibility: "public" | "private" | "password", passwordHash: string | null = null) => {
    const [p] = await db.insert(schema.projects).values({ slug, title, visibility, published: true, passwordHash, categoryId: cat.id }).returning();
    for (const c of ["#8b5cf6", "#0ea5e9"]) await createPhotoFromUpload({ projectId: p.id, batchId: null, buffer: await img(c), originalName: `${slug}-${c.slice(1)}.jpg`, caption: `Legenda ${slug}` });
    return p;
  };
  const pub = await mk("projeto-publico", "Projeto Público", "public");
  const priv = await mk("galeria-privada", "Galeria Privada", "private");
  const pwd = await mk("galeria-senha", "Galeria com Senha", "password", await hashPassword("segredo123"));
  await db.insert(schema.projectAccess).values({ projectId: priv.id, email: client.email, userId: client.id, canDownload: true, invitedBy: admin.id });

  writeFileSync("tests/e2e/.fixtures.json", JSON.stringify({ pub: pub.slug, priv: { id: priv.id, slug: priv.slug }, pwd: pwd.slug, password: "Senha-e2e-123" }, null, 2));
  console.log("✓ Fixtures E2E prontas");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
