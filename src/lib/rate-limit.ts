import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Limite por janela fixa, persistido no Postgres (funciona com várias instâncias).
 * Retorna true se a ação é permitida.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec})
                   then now() else rate_limits.window_start end
    returning count
  `);
  const count = Number(rows[0]?.count ?? 0);
  return count <= limit;
}
