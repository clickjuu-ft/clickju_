import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { setUserDisabled } from "@/server/admin/content-actions";
import { PageHeader, Empty, SubmitButton } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Clientes" };

export default async function ClientsAdmin() {
  await requireAdmin();
  const users = await db
    .select({
      u: schema.users,
      galleries: sql<number>`(select count(*)::int from project_access a where a.user_id = ${schema.users.id})`,
      favs: sql<number>`(select count(*)::int from favorites f where f.user_id = ${schema.users.id})`,
    })
    .from(schema.users)
    .where(eq(schema.users.role, "client"))
    .orderBy(desc(schema.users.createdAt));
  const access = await db
    .select({ a: schema.projectAccess, title: schema.projects.title })
    .from(schema.projectAccess)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.projectAccess.projectId));
  return (
    <>
      <PageHeader title="Clientes e acessos" description="Para liberar uma galeria, abra o projeto em Projetos e galerias → Acesso de clientes. Cada cliente vê somente os projetos liberados para o seu e-mail." />
      {users.length === 0 ? (
        <Empty>Nenhum cliente cadastrado ainda.</Empty>
      ) : (
        <div className="overflow-x-auto border border-line bg-ink">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-[0.68rem] uppercase tracking-[0.14em] text-mist">
              <tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Galerias</th><th className="px-4 py-3">Favoritas</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map(({ u, favs }) => (
                <tr key={u.id} className={u.disabled ? "opacity-50" : ""}>
                  <td className="px-4 py-3"><span className="font-medium">{u.name}</span><span className="block text-xs text-mist">{u.email}</span></td>
                  <td className="px-4 py-3">
                    {access.filter((x) => x.a.userId === u.id).map((x) => (
                      <Link key={x.a.id} href={`/admin/projetos/${x.a.projectId}`} className="mr-2 text-lilac hover:underline">{x.title}</Link>
                    ))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{favs}</td>
                  <td className="px-4 py-3 text-mist">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={setUserDisabled}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="disabled" value={u.disabled ? "0" : "1"} />
                      <SubmitButton variant={u.disabled ? "ghost" : "danger"}>{u.disabled ? "Reativar" : "Desativar"}</SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {access.some((x) => !x.a.userId) && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-mist">Convites pendentes (sem conta criada)</h2>
          <ul className="space-y-1 text-sm">
            {access.filter((x) => !x.a.userId).map((x) => <li key={x.a.id}>{x.a.email} → {x.title}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
