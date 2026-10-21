import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Recria o esquema do banco de TESTES (nunca use o banco de produção aqui). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://foto:foto@localhost:5432/foto_test";
  if (!/test/i.test(url)) throw new Error("TEST_DATABASE_URL precisa apontar para um banco de testes (nome contendo 'test').");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`drop schema if exists public cascade`;
  await sql`drop schema if exists drizzle cascade`;
  await sql`create schema public`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
}
