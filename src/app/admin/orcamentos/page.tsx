import Link from "next/link";
import { Download, KanbanSquare, Table2 } from "lucide-react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { listQuotes, parseQuoteFilters, serviceNameMap, statusCounts } from "@/lib/quotes/admin";
import { QUOTE_STATUSES, statusLabel } from "@/lib/quotes/schema";
import { PageHeader, StatusBadge, Empty } from "@/components/admin/ui";
import { QuoteKanban } from "@/components/admin/quote-kanban";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Orçamentos" };

export default async function QuotesPage(props: PageProps<"/admin/orcamentos">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const f = parseQuoteFilters(sp);
  const view = sp.view === "kanban" ? "kanban" : "tabela";
  const [quotes, counts, names, services] = await Promise.all([
    listQuotes(f),
    statusCounts(f),
    serviceNameMap(),
    db.query.services.findMany({ orderBy: [asc(schema.services.sort)] }),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q: f.q, status: f.status, servico: f.service, de: f.from, ate: f.to, arquivados: f.archived ? "1" : undefined, view,
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
    return `?${p}`;
  };
  const exportQs = new URLSearchParams(
    Object.entries({ q: f.q, status: f.status, servico: f.service, de: f.from, ate: f.to, arquivados: f.archived ? "1" : undefined }).filter(
      ([, v]) => v,
    ) as [string, string][],
  );

  return (
    <>
      <PageHeader title="Orçamentos" description="Solicitações recebidas pelo site. Clique em um pedido para ver detalhes, registrar contatos e criar propostas.">
        <a href={`/api/admin/quotes/export?${exportQs}`} className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
          <Download className="size-4" aria-hidden /> Exportar CSV
        </a>
      </PageHeader>

      {/* contadores por status */}
      <nav aria-label="Filtrar por status" className="mb-6 flex flex-wrap gap-2">
        <Link href={qs({ status: undefined })} className={cn("border px-3 py-1.5 text-xs", !f.status ? "border-paper bg-paper text-ink" : "border-line hover:border-paper")}>
          Todos <span className="ml-1 tabular-nums opacity-70">{total}</span>
        </Link>
        {QUOTE_STATUSES.map((s) => (
          <Link
            key={s.value}
            href={qs({ status: s.value })}
            className={cn("border px-3 py-1.5 text-xs", f.status === s.value ? "border-paper bg-paper text-ink" : "border-line hover:border-paper")}
          >
            {s.label} <span className="ml-1 tabular-nums opacity-70">{counts[s.value] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <form className="mb-6 grid gap-3 border border-line bg-ink p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]" role="search">
        <input type="hidden" name="view" value={view} />
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <label>
          <span className="label">Buscar</span>
          <input name="q" defaultValue={f.q} placeholder="Nome, e-mail, código, telefone, cidade…" className="input" />
        </label>
        <label>
          <span className="label">Serviço</span>
          <select name="servico" defaultValue={f.service ?? ""} className="input">
            <option value="">Todos</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">De</span>
          <input type="date" name="de" defaultValue={f.from} className="input" />
        </label>
        <label>
          <span className="label">Até</span>
          <input type="date" name="ate" defaultValue={f.to} className="input" />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="arquivados" value="1" defaultChecked={f.archived} className="size-4 accent-violet" /> Arquivados
        </label>
        <div className="flex items-end">
          <button className="h-9 w-full bg-paper px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-violet hover:text-white">Filtrar</button>
        </div>
      </form>

      <div className="mb-4 flex gap-1" role="group" aria-label="Visualização">
        <Link href={qs({ view: "tabela" })} aria-current={view === "tabela" ? "page" : undefined} className={cn("flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-[0.12em]", view === "tabela" ? "bg-paper text-ink" : "text-mist hover:text-paper")}>
          <Table2 className="size-4" aria-hidden /> Tabela
        </Link>
        <Link href={qs({ view: "kanban" })} aria-current={view === "kanban" ? "page" : undefined} className={cn("flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-[0.12em]", view === "kanban" ? "bg-paper text-ink" : "text-mist hover:text-paper")}>
          <KanbanSquare className="size-4" aria-hidden /> Kanban
        </Link>
      </div>

      {view === "kanban" ? (
        <QuoteKanban
          cards={quotes.map((q) => ({
            id: q.id,
            code: q.code,
            name: q.name,
            services: q.services.map((s) => names[s] ?? s).join(", "),
            createdAt: q.createdAt.toISOString(),
            eventDate: q.eventDate ? formatDate(q.eventDate) : null,
            status: q.status,
            budget: q.budgetRange,
          }))}
        />
      ) : quotes.length === 0 ? (
        <Empty>Nenhum pedido encontrado com estes filtros.</Empty>
      ) : (
        <div className="overflow-x-auto border border-line bg-ink">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line text-[0.68rem] uppercase tracking-[0.14em] text-mist">
              <tr>
                <th className="px-4 py-3 font-semibold">Recebido</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Serviços</th>
                <th className="px-4 py-3 font-semibold">Data do evento</th>
                <th className="px-4 py-3 font-semibold">Investimento</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-ink-2/60">
                  <td className="whitespace-nowrap px-4 py-3 text-mist">{formatDateTime(q.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orcamentos/${q.id}`} className="font-semibold hover:text-lilac">
                      {q.name}
                    </Link>
                    <span className="block font-mono text-[0.68rem] text-mist">{q.code} · {q.city}/{q.state}</span>
                  </td>
                  <td className="px-4 py-3">{q.services.map((s) => names[s] ?? s).join(", ")}</td>
                  <td className="whitespace-nowrap px-4 py-3">{q.eventDate ? formatDate(q.eventDate) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{q.budgetRange}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} label={statusLabel(q.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
