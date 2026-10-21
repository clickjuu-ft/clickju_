import "server-only";
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { QUOTE_STATUSES } from "@/lib/quotes/schema";

export type QuoteFilters = {
  q?: string;
  status?: string;
  service?: string;
  from?: string;
  to?: string;
  archived?: boolean;
};

export function parseQuoteFilters(sp: Record<string, string | string[] | undefined>): QuoteFilters {
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string).slice(0, 100) : undefined);
  return { q: s("q"), status: s("status"), service: s("servico"), from: s("de"), to: s("ate"), archived: sp.arquivados === "1" };
}

export function quoteWhere(f: QuoteFilters): SQL | undefined {
  const w: SQL[] = [eq(schema.quoteRequests.archived, !!f.archived)];
  if (f.status && QUOTE_STATUSES.some((s) => s.value === f.status)) {
    w.push(eq(schema.quoteRequests.status, f.status as (typeof QUOTE_STATUSES)[number]["value"]));
  }
  if (f.service) w.push(sql`${f.service} = any(${schema.quoteRequests.services})`);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) w.push(gte(schema.quoteRequests.createdAt, new Date(`${f.from}T00:00:00-03:00`)));
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) w.push(lte(schema.quoteRequests.createdAt, new Date(`${f.to}T23:59:59-03:00`)));
  if (f.q) {
    const q = `%${f.q}%`;
    w.push(
      or(
        ilike(schema.quoteRequests.name, q),
        ilike(schema.quoteRequests.email, q),
        ilike(schema.quoteRequests.code, q),
        ilike(schema.quoteRequests.whatsapp, `%${f.q.replace(/\D/g, "") || f.q}%`),
        ilike(schema.quoteRequests.city, q),
        ilike(schema.quoteRequests.description, q),
        ilike(schema.quoteRequests.location, q),
      )!,
    );
  }
  return and(...w);
}

export async function listQuotes(f: QuoteFilters, limit = 500) {
  return db.query.quoteRequests.findMany({
    where: quoteWhere(f),
    orderBy: [desc(schema.quoteRequests.createdAt)],
    limit,
  });
}

/** Contadores por status (considerando os demais filtros, exceto o próprio status). */
export async function statusCounts(f: QuoteFilters) {
  const rows = await db
    .select({ status: schema.quoteRequests.status, n: sql<number>`count(*)::int` })
    .from(schema.quoteRequests)
    .where(quoteWhere({ ...f, status: undefined }))
    .groupBy(schema.quoteRequests.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}

export async function serviceNameMap() {
  const rows = await db.query.services.findMany();
  return Object.fromEntries(rows.map((s) => [s.slug, s.name])) as Record<string, string>;
}
