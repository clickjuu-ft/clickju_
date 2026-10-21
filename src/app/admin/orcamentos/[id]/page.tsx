import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { ArrowLeft, Bell, Check, FileText, MessageCircle, Paperclip, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { storage } from "@/lib/storage";
import { whatsappLink } from "@/lib/settings";
import { QUOTE_STATUSES, statusLabel } from "@/lib/quotes/schema";
import { serviceNameMap } from "@/lib/quotes/admin";
import {
  addQuoteNote, addReminder, anonymizeQuote, saveQuoteCommercial, setArchived, setQuoteStatusForm, toggleReminder,
} from "@/server/admin/quote-actions";
import { ActionForm } from "@/components/forms/action-form";
import { Panel, StatusBadge, SubmitButton } from "@/components/admin/ui";
import { cn, formatBRL, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Pedido de orçamento" };

const EVENT_LABEL: Record<string, string> = { note: "Observação interna", contact: "Contato", status: "Status", system: "Sistema" };

export default async function QuoteDetail(props: PageProps<"/admin/orcamentos/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, id) });
  if (!q) notFound();

  const [events, reminders, previous, names, proposals, authors] = await Promise.all([
    db.query.quoteEvents.findMany({ where: eq(schema.quoteEvents.quoteId, id), orderBy: [desc(schema.quoteEvents.createdAt)] }),
    db.query.quoteReminders.findMany({ where: eq(schema.quoteReminders.quoteId, id), orderBy: [asc(schema.quoteReminders.dueAt)] }),
    db.query.quoteRequests.findMany({
      where: and(sql`lower(${schema.quoteRequests.email}) = lower(${q.email})`, ne(schema.quoteRequests.id, id)),
      orderBy: [desc(schema.quoteRequests.createdAt)],
      limit: 10,
    }),
    serviceNameMap(),
    db.query.proposals.findMany({ where: eq(schema.proposals.quoteId, id), orderBy: [desc(schema.proposals.createdAt)] }),
    db.query.users.findMany({ columns: { id: true, name: true } }),
  ]);
  const authorName = (uid: string | null) => authors.find((a) => a.id === uid)?.name;
  const attachments = await Promise.all(
    q.attachments.map(async (a) => ({ ...a, url: await storage().signedUrl(a.key, { access: "private", download: a.name }) })),
  );
  const wa = whatsappLink(`55${q.whatsapp}`, `Olá, ${q.name.split(" ")[0]}! Aqui é da Clickju, sobre sua solicitação ${q.code}.`);

  const field = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="grid gap-1 border-b border-line py-2.5 text-sm sm:grid-cols-[170px_1fr]">
        <dt className="text-xs uppercase tracking-[0.12em] text-mist">{label}</dt>
        <dd className="whitespace-pre-line break-words">{value}</dd>
      </div>
    ) : null;

  return (
    <>
      <Link href="/admin/orcamentos" className="mb-4 inline-flex items-center gap-1 text-sm text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Orçamentos
      </Link>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs text-mist">{q.code} · recebido em {formatDateTime(q.createdAt)}</p>
          <h1 className="mt-1 text-3xl font-extrabold uppercase tracking-tight [font-stretch:80%]">{q.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={q.status} label={statusLabel(q.status)} />
            {q.archived && <span className="bg-ink-3 px-2 py-0.5 text-[0.68rem] uppercase">Arquivado</span>}
            {q.anonymizedAt && <span className="bg-ink-3 px-2 py-0.5 text-[0.68rem] uppercase">Anonimizado</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && !q.anonymizedAt && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
              <MessageCircle className="size-4" aria-hidden /> WhatsApp
            </a>
          )}
          {!q.anonymizedAt && (
            <a href={`mailto:${q.email}?subject=${encodeURIComponent(`Sua solicitação ${q.code}`)}`} className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
              E-mail
            </a>
          )}
          <Link href={`/admin/propostas/nova?pedido=${q.id}`} className="inline-flex h-9 items-center gap-2 bg-violet px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-lilac">
            <FileText className="size-4" aria-hidden /> Criar proposta
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Status do fluxo comercial">
            <form action={setQuoteStatusForm} className="flex flex-wrap gap-2">
              <input type="hidden" name="quoteId" value={q.id} />
              {QUOTE_STATUSES.map((s) => (
                <button
                  key={s.value}
                  name="status"
                  value={s.value}
                  aria-pressed={q.status === s.value}
                  className={cn(
                    "border px-3 py-1.5 text-xs transition-colors",
                    q.status === s.value ? "border-paper bg-paper text-ink" : "border-line hover:border-paper",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </form>
          </Panel>

          <Panel title="Dados do cliente">
            <dl>
              {field("E-mail", q.email)}
              {field("WhatsApp", q.whatsapp)}
              {field("Cidade", `${q.city}/${q.state}`)}
              {field("Prefere contato por", q.contactPreference)}
              {field("Origem", q.source)}
            </dl>
          </Panel>

          <Panel title="Projeto">
            <dl>
              {field("Serviços", q.services.map((s) => names[s] ?? s).join(", "))}
              {field("Data", q.eventDate ? formatDate(q.eventDate, { dateStyle: "full" }) : "A definir")}
              {field("Data alternativa", q.altDate && formatDate(q.altDate, { dateStyle: "full" }))}
              {field("Local", q.location)}
              {field("Duração", q.duration)}
              {field("Participantes", q.participants)}
              {field("Descrição", q.description)}
              {field("Necessidades específicas", q.specificNeeds)}
            </dl>
            {attachments.length > 0 && (
              <ul className="mt-4 space-y-2">
                {attachments.map((a) => (
                  <li key={a.key}>
                    <a href={a.url} className="inline-flex items-center gap-2 text-sm text-lilac hover:underline">
                      <Paperclip className="size-4" aria-hidden /> {a.name} <span className="text-mist">({(a.bytes / 1024 / 1024).toFixed(1)} MB)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Informações comerciais do cliente">
            <dl>
              {field("Faixa de investimento", q.budgetRange)}
              {field("Qtd. de fotografias", q.photoCount)}
              {field("Prazo esperado", q.deadline)}
              {field("Adicionais", q.addons.join(", "))}
              {field("Complementares", q.extraInfo)}
            </dl>
          </Panel>

          <Panel title="Histórico">
            <ol className="space-y-4">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 border-line pl-4">
                  <p className="text-xs text-mist">
                    {formatDateTime(e.createdAt)} · {EVENT_LABEL[e.kind] ?? e.kind}
                    {e.channel ? ` · ${e.channel}` : ""}
                    {authorName(e.authorId) ? ` · ${authorName(e.authorId)}` : ""}
                  </p>
                  <p className={cn("mt-1 whitespace-pre-line text-sm", e.kind === "system" && "text-mist")}>{e.body}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Proposta e negociação">
            <ActionForm action={saveQuoteCommercial} submitLabel="Salvar" className="space-y-4">
              <input type="hidden" name="quoteId" value={q.id} />
              <label className="block">
                <span className="label">Valor da proposta (R$)</span>
                <input name="proposalValue" inputMode="decimal" defaultValue={q.proposalValue ? String(q.proposalValue).replace(".", ",") : ""} placeholder="Definido por você" className="input" />
              </label>
              <label className="block">
                <span className="label">Validade do orçamento</span>
                <input type="date" name="validUntil" defaultValue={q.validUntil ?? ""} className="input" />
              </label>
              <label className="block">
                <span className="label">Resultado da negociação</span>
                <textarea name="outcome" rows={3} defaultValue={q.outcome ?? ""} className="input" placeholder="Ex.: aprovado com 2 horas extras; recusado por orçamento…" />
              </label>
            </ActionForm>
            {q.proposalValue && <p className="mt-3 text-xs text-mist">Valor atual: {formatBRL(q.proposalValue)}</p>}
            {proposals.length > 0 && (
              <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                {proposals.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/propostas/${p.id}`} className="font-medium hover:text-lilac">
                      {p.number} · {formatBRL(p.total)}
                    </Link>
                    <span className="text-xs uppercase text-mist">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Registrar contato ou observação">
            <ActionForm action={addQuoteNote} submitLabel="Registrar" className="space-y-4">
              <input type="hidden" name="quoteId" value={q.id} />
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="kind" value="note" defaultChecked className="accent-violet" /> Observação interna
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="kind" value="contact" className="accent-violet" /> Contato realizado
                </label>
              </div>
              <label className="block">
                <span className="label">Canal (para contatos)</span>
                <select name="channel" className="input">
                  <option value="">—</option>
                  <option>WhatsApp</option>
                  <option>E-mail</option>
                  <option>Telefone</option>
                  <option>Reunião</option>
                  <option>Instagram</option>
                </select>
              </label>
              <textarea name="body" rows={3} required className="input" placeholder="O que foi conversado / observação" />
            </ActionForm>
          </Panel>

          <Panel title="Lembretes de acompanhamento">
            <ul className="mb-4 space-y-2">
              {reminders.map((r) => {
                const overdue = !r.doneAt && r.dueAt < new Date();
                return (
                  <li key={r.id} className="flex items-start gap-3 text-sm">
                    <form action={toggleReminder}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        className={cn("mt-0.5 grid size-5 place-items-center border", r.doneAt ? "border-violet bg-violet text-white" : "border-line-strong")}
                        aria-label={r.doneAt ? "Reabrir lembrete" : "Concluir lembrete"}
                      >
                        {r.doneAt && <Check className="size-3" />}
                      </button>
                    </form>
                    <div className={cn(r.doneAt && "text-mist line-through")}>
                      <p>{r.note}</p>
                      <p className={cn("text-xs", overdue ? "text-danger" : "text-mist")}>
                        <Bell className="mr-1 inline size-3" aria-hidden />
                        {formatDateTime(r.dueAt)} {overdue && "· atrasado"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ActionForm action={addReminder} submitLabel="Agendar lembrete" className="space-y-3">
              <input type="hidden" name="quoteId" value={q.id} />
              <input type="datetime-local" name="dueAt" required className="input" aria-label="Data e hora" />
              <input name="note" required placeholder="Ex.: retornar sobre a proposta" className="input" aria-label="Descrição" />
            </ActionForm>
          </Panel>

          {previous.length > 0 && (
            <Panel title="Solicitações anteriores deste cliente">
              <ul className="space-y-2 text-sm">
                {previous.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link href={`/admin/orcamentos/${p.id}`} className="hover:text-lilac">
                      {p.code} · {formatDate(p.createdAt)}
                    </Link>
                    <StatusBadge status={p.status} label={statusLabel(p.status)} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Arquivo e privacidade">
            <form action={setArchived} className="mb-4">
              <input type="hidden" name="quoteId" value={q.id} />
              <input type="hidden" name="archived" value={q.archived ? "0" : "1"} />
              <SubmitButton variant="ghost">{q.archived ? "Desarquivar" : "Arquivar pedido"}</SubmitButton>
            </form>
            {!q.anonymizedAt && (
              <details className="text-sm">
                <summary className="cursor-pointer text-danger">Anonimizar dados pessoais (LGPD)</summary>
                <form action={anonymizeQuote} className="mt-3 space-y-2">
                  <input type="hidden" name="quoteId" value={q.id} />
                  <p className="text-xs text-mist">
                    Remove nome, contatos, descrição e anexos de forma irreversível, mantendo apenas dados estatísticos. Use para atender
                    pedidos de exclusão do titular. Digite ANONIMIZAR para confirmar.
                  </p>
                  {sp.erro === "confirmacao" && <p className="text-xs text-danger">Confirmação incorreta.</p>}
                  <input name="confirm" className="input" aria-label="Confirmação" />
                  <SubmitButton variant="danger">
                    <Plus className="hidden" /> Anonimizar
                  </SubmitButton>
                </form>
              </details>
            )}
            <p className="mt-4 text-xs text-mist">
              Notificação à fotógrafa: {q.notifiedAt ? `enviada em ${formatDateTime(q.notifiedAt)}` : "não enviada (e-mail não configurado ou falhou)"}.
              <br />
              Confirmação ao cliente: {q.confirmationSentAt ? `enviada em ${formatDateTime(q.confirmationSentAt)}` : "não enviada"}.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
