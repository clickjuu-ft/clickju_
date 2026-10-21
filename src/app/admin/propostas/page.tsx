import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader, Empty } from "@/components/admin/ui";
import { formatBRL, formatDate } from "@/lib/utils";

export const metadata = { title: "Propostas" };

export default async function ProposalsPage() {
  await requireAdmin();
  const rows = await db
    .select({ p: schema.proposals, name: schema.quoteRequests.name, code: schema.quoteRequests.code })
    .from(schema.proposals)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.proposals.quoteId))
    .orderBy(desc(schema.proposals.createdAt));
  return (
    <>
      <PageHeader title="Propostas" description="Para criar uma proposta, abra um pedido de orçamento e clique em “Criar proposta”." />
      {rows.length === 0 ? (
        <Empty>Nenhuma proposta criada ainda.</Empty>
      ) : (
        <div className="overflow-x-auto border border-line bg-ink">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-line text-[0.68rem] uppercase tracking-[0.14em] text-mist">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ p, name, code }) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/propostas/${p.id}`} className="font-semibold hover:text-lilac">{p.number}</Link>
                  </td>
                  <td className="px-4 py-3">{name} <span className="font-mono text-xs text-mist">{code}</span></td>
                  <td className="px-4 py-3">{formatBRL(p.total)}</td>
                  <td className="px-4 py-3">{formatDate(p.validUntil)}</td>
                  <td className="px-4 py-3 text-xs uppercase">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
