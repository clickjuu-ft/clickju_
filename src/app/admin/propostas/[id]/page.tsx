import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { setProposalStatus } from "@/server/admin/proposal-actions";
import { ProposalEditor } from "@/components/admin/proposal-editor";
import { PageHeader, SubmitButton } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Proposta" };

export default async function ProposalPage(props: PageProps<"/admin/propostas/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!p) notFound();
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, p.quoteId) });
  return (
    <>
      <Link href={`/admin/orcamentos/${p.quoteId}`} className="mb-4 inline-flex items-center gap-1 text-sm text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Pedido {q?.code}
      </Link>
      <PageHeader title={`Proposta ${p.number}`} description={`Cliente: ${q?.name ?? "—"} · Status: ${p.status}`}>
        {p.status === "enviada" && (
          <form action={setProposalStatus}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="status" value="recusada" />
            <SubmitButton variant="ghost">Marcar como recusada</SubmitButton>
          </form>
        )}
      </PageHeader>
      {p.acceptedAt && (
        <p className="mb-6 border border-ok/40 bg-emerald-50 p-4 text-sm">
          ✓ Aceita por <strong>{p.acceptedName}</strong> em {formatDateTime(p.acceptedAt)}.
        </p>
      )}
      <ProposalEditor
        p={{
          id: p.id, title: p.title, scope: p.scope, hours: p.hours, deliverables: p.deliverables, deliveryDeadline: p.deliveryDeadline,
          items: p.items, total: String(p.total), paymentTerms: p.paymentTerms, validUntil: p.validUntil, conditions: p.conditions, status: p.status,
        }}
      />
    </>
  );
}
