import Link from "next/link";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { AlertTriangle, Bell, CheckCircle2, CircleDashed } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { statusLabel } from "@/lib/quotes/schema";
import { integrationStatus } from "@/lib/integrations";
import { PageHeader, Panel, Stat, StatusBadge, Empty } from "@/components/admin/ui";
import { formatBRL, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Visão geral" };

function periods() {
  const now = new Date();
  return { now, monthStart: new Date(now.getFullYear(), now.getMonth(), 1), soon: new Date(now.getTime() + 3 * 86400_000) };
}

export default async function AdminHome() {
  await requireAdmin();
  const { now, monthStart, soon } = periods();
  const [novos, ativos, aprovadosMes, valorMes, reminders, latest, photos, projects] = await Promise.all([
    db.$count(schema.quoteRequests, and(eq(schema.quoteRequests.status, "novo"), eq(schema.quoteRequests.archived, false))),
    db.$count(
      schema.quoteRequests,
      and(inArray(schema.quoteRequests.status, ["em_analise", "aguardando_info", "preparando_proposta", "proposta_enviada", "em_negociacao"]), eq(schema.quoteRequests.archived, false)),
    ),
    db.$count(schema.quoteRequests, and(eq(schema.quoteRequests.status, "aprovado"), gte(schema.quoteRequests.updatedAt, monthStart))),
    db
      .select({ v: sql<string>`coalesce(sum(${schema.quoteRequests.proposalValue}), 0)` })
      .from(schema.quoteRequests)
      .where(and(eq(schema.quoteRequests.status, "aprovado"), gte(schema.quoteRequests.updatedAt, monthStart))),
    db
      .select({ r: schema.quoteReminders, name: schema.quoteRequests.name, code: schema.quoteRequests.code })
      .from(schema.quoteReminders)
      .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.quoteReminders.quoteId))
      .where(and(isNull(schema.quoteReminders.doneAt), lte(schema.quoteReminders.dueAt, soon)))
      .orderBy(schema.quoteReminders.dueAt)
      .limit(10),
    db.query.quoteRequests.findMany({ where: eq(schema.quoteRequests.archived, false), orderBy: [desc(schema.quoteRequests.createdAt)], limit: 6 }),
    db.$count(schema.photos),
    db.$count(schema.projects),
  ]);
  const integrations = integrationStatus();

  return (
    <>
      <PageHeader title="Visão geral" description="Resumo do comercial e do portfólio." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Novos pedidos" value={novos} hint="aguardando análise" />
        <Stat label="Em andamento" value={ativos} hint="análise, proposta ou negociação" />
        <Stat label="Aprovados no mês" value={aprovadosMes} hint={formatBRL(valorMes[0]?.v ?? 0)} />
        <Stat label="Portfólio" value={photos} hint={`fotografias em ${projects} projetos`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Lembretes (atrasados e próximos 3 dias)">
          {reminders.length === 0 ? (
            <p className="text-sm text-mist">Nenhum lembrete pendente.</p>
          ) : (
            <ul className="space-y-3">
              {reminders.map(({ r, name, code }) => (
                <li key={r.id} className="flex items-start gap-3 text-sm">
                  <Bell className={r.dueAt < now ? "mt-0.5 size-4 text-danger" : "mt-0.5 size-4 text-lilac"} aria-hidden />
                  <div>
                    <Link href={`/admin/orcamentos/${r.quoteId}`} className="font-medium hover:text-lilac">
                      {r.note}
                    </Link>
                    <p className="text-xs text-mist">
                      {name} · {code} · {formatDateTime(r.dueAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Pedidos recentes" actions={<Link href="/admin/orcamentos" className="text-xs text-lilac hover:underline">Ver todos</Link>}>
          {latest.length === 0 ? (
            <Empty>Nenhum pedido ainda. Eles aparecem aqui assim que chegarem pelo site.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {latest.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/orcamentos/${q.id}`} className="hover:text-lilac">
                    <span className="font-medium">{q.name}</span>
                    <span className="ml-2 font-mono text-xs text-mist">{q.code}</span>
                  </Link>
                  <StatusBadge status={q.status} label={statusLabel(q.status)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Integrações" className="xl:col-span-2">
          <ul className="grid gap-3 md:grid-cols-2">
            {integrations.map((i) => (
              <li key={i.key} className="flex items-start gap-3 text-sm">
                {i.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Ativa" />
                ) : i.key === "turnstile" ? (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-mist" aria-label="Opcional" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Não configurada" />
                )}
                <div>
                  <p className="font-medium">{i.label}</p>
                  {!i.ok && <p className="text-xs text-mist">{i.how} Veja o README.</p>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
