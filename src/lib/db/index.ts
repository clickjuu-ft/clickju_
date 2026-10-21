import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Reaproveita a conexão entre recarregamentos em desenvolvimento.
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres>; __db?: DB };

function getDb(): DB {
  if (globalForDb.__db) return globalForDb.__db;
  const client =
    globalForDb.__pg ??
    postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Supabase (pooler em modo transação) não suporta prepared statements
      prepare: process.env.DATABASE_PREPARE !== "false",
      onnotice: () => {},
    });
  globalForDb.__pg = client;
  globalForDb.__db = drizzle(client, { schema });
  return globalForDb.__db;
}

/**
 * Conexão criada sob demanda (na primeira consulta), para que o build não exija DATABASE_URL.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
