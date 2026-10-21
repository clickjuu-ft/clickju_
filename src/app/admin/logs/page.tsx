import { desc, eq, ilike } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Registro de atividades" };

export default async function LogsPage(props: PageProps<"/admin/logs">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.acao === "string" ? sp.acao.slice(0, 60) : "";
  const rows = await db
    .select({ l: schema.auditLogs, name: schema.users.name })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.userId))
    .where(q ? ilike(schema.auditLogs.action, `%${q}%`) : undefined)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(300);
  return (
    <>
      <PageHeader title="Registro de atividades" description="Operações administrativas, acessos e eventos de segurança (somente inserção — não pode ser alterado pela aplicação). IPs são armazenados apenas como hash." />
      <form className="mb-4 flex gap-2">
        <input name="acao" defaultValue={q} placeholder="Filtrar ação (ex.: login, orcamento, foto)" className="input max-w-sm" />
        <button className="h-9 bg-paper px-4 text-xs font-semibold uppercase text-ink">Filtrar</button>
      </form>
      <div className="overflow-x-auto border border-line bg-ink">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-[0.68rem] uppercase tracking-[0.14em] text-mist">
            <tr><th className="px-4 py-2">Quando</th><th className="px-4 py-2">Quem</th><th className="px-4 py-2">Ação</th><th className="px-4 py-2">Detalhes</th></tr>
          </thead>
          <tbody className="divide-y divide-line font-mono text-xs">
            {rows.map(({ l, name }) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(l.createdAt)}</td>
                <td className="px-4 py-2">{name ?? "—"}</td>
                <td className="px-4 py-2">{l.action}</td>
                <td className="max-w-md truncate px-4 py-2 text-mist" title={JSON.stringify(l.meta)}>{l.entity} {l.entityId?.slice(0, 8)} {l.meta ? JSON.stringify(l.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
