import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/lib/env";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Reaproveita a conexão entre recarregamentos em desenvolvimento.
const globalForDb = globalThis as unknown as { __pg?: ReturnType<typeof postgres>; __db?: DB };

function create(): DB {
  const client =
    globalForDb.__pg ??
    postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Supabase (pooler em modo transação) não suporta prepared statements
      prepare: process.env.DATABASE_PREPARE !== "false",
      onnotice: () => {},
    });
  globalForDb.__pg = client;
  return drizzle(client, { schema });
}

export const db: DB = globalForDb.__db ?? (globalForDb.__db = create());
export { schema };
