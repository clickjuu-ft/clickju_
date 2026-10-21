import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { createProposalFromQuote } from "@/server/admin/proposal-actions";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Nova proposta" };

export default async function NewProposal(props: PageProps<"/admin/propostas/nova">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const id = typeof sp.pedido === "string" ? sp.pedido : "";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, id) });
  if (!q) notFound();
  return (
    <>
      <PageHeader title="Nova proposta" />
      <Panel>
        <p className="text-sm">
          Criar um rascunho de proposta para <strong>{q.name}</strong> ({q.code}). Os textos são pré-preenchidos com os dados do pedido; o
          <strong> valor e as condições são definidos por você</strong> antes do envio.
        </p>
        <form action={createProposalFromQuote} className="mt-5">
          <input type="hidden" name="quoteId" value={q.id} />
          <SubmitButton variant="violet">Criar rascunho</SubmitButton>
        </form>
      </Panel>
    </>
  );
}
