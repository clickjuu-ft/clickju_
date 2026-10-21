import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { acceptProposal } from "@/server/proposal-public";
import { ActionForm } from "@/components/forms/action-form";
import { formatBRL, formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

export default async function PublicProposal(props: PageProps<"/proposta/[token]">) {
  const { token } = await props.params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.acceptTokenHash, sha256(token)) });
  if (!p) notFound();
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, p.quoteId) });
  if (!q) notFound();
  const services = await db.query.services.findMany({ where: inArray(schema.services.slug, q.services) });
  const expired = p.validUntil < new Date().toISOString().slice(0, 10);

  const block = (title: string, body: React.ReactNode) => (
    <section className="border-t border-line py-6">
      <h2 className="eyebrow mb-3">{title}</h2>
      <div className="whitespace-pre-line text-paper-2/90">{body}</div>
    </section>
  );

  return (
    <article className="mx-auto max-w-3xl px-5 pb-28 pt-32">
      <p className="font-mono text-xs text-mist">Proposta {p.number} · {formatDate(p.createdAt)}</p>
      <h1 className="display mt-3 text-5xl md:text-6xl">{p.title}</h1>
      <p className="mt-4 text-mist">Para {q.name}</p>
      <a href={`/api/proposals/${token}/pdf`} className="mt-6 inline-flex items-center gap-2 border border-line-strong px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
        <Download className="size-4" aria-hidden /> Baixar PDF
      </a>
      <div className="mt-10">
        {block("Serviço", `${services.map((s) => s.name).join(", ")}${q.eventDate ? ` · ${formatDate(q.eventDate, { dateStyle: "full" })}` : ""}${q.location ? ` · ${q.location}` : ""}`)}
        {block("Escopo da cobertura", p.scope)}
        {p.hours && block("Horas previstas", p.hours)}
        {block("Entregáveis", `${p.deliverables}\n\nPrazo de entrega: ${p.deliveryDeadline}`)}
        {block(
          "Investimento",
          <>
            {p.items.length > 0 && (
              <ul className="mb-4 divide-y divide-line">
                {p.items.map((i, k) => (
                  <li key={k} className="flex justify-between gap-4 py-2">
                    <span>{i.description}</span>
                    <span className="tabular-nums">{formatBRL(i.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="flex items-baseline justify-between bg-paper px-5 py-4 text-ink">
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Valor total</span>
              <span className="text-2xl font-bold tabular-nums">{formatBRL(p.total)}</span>
            </p>
            <p className="mt-4">Pagamento: {p.paymentTerms}</p>
            <p className="mt-1 text-sm text-mist">Válida até {formatDate(p.validUntil, { dateStyle: "long" })}.</p>
          </>,
        )}
        {p.conditions && block("Condições adicionais", p.conditions)}
      </div>

      <section className="mt-6 border border-line p-6">
        <h2 className="eyebrow mb-4">Aceite</h2>
        {p.status === "aceita" && p.acceptedAt ? (
          <p>✓ Aceita por <strong>{p.acceptedName}</strong> em {formatDateTime(p.acceptedAt)}.</p>
        ) : p.status !== "enviada" ? (
          <p className="text-mist">Esta proposta não está disponível para aceite.</p>
        ) : expired ? (
          <p className="text-mist">Esta proposta expirou. Entre em contato para receber uma nova versão.</p>
        ) : (
          <ActionForm action={acceptProposal} submitLabel="Aceitar proposta" variant="violet" hideOnSuccess>
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="name" className="label">Seu nome completo</label>
              <input id="name" name="name" required autoComplete="name" className="field" />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="agree" className="mt-0.5 size-5 accent-violet" />
              Li e concordo com o escopo, valores e condições desta proposta. Entendo que a data é confirmada pela fotógrafa após o aceite.
            </label>
          </ActionForm>
        )}
      </section>
    </article>
  );
}
