import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { Bell } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { clientProjectIds } from "@/lib/access";
import { toCards } from "@/lib/portfolio";
import { deleteMyAccount, markNotificationsRead } from "@/server/client-actions";
import { changePassword, logout } from "@/server/auth-actions";
import { ActionForm } from "@/components/forms/action-form";
import { Picture } from "@/components/ui/picture";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Minha área" };

const STAGE: Record<string, string> = {
  agendado: "Agendado",
  em_producao: "Em produção",
  em_edicao: "Em edição",
  selecao_cliente: "Aguardando sua seleção",
  finalizando: "Finalizando",
  entregue: "Entregue",
};
const ORDER = ["agendado", "em_producao", "em_edicao", "selecao_cliente", "finalizando", "entregue"];

export default async function ClientHome() {
  const user = await requireUser("/cliente");
  const ids = await clientProjectIds(user);
  const rows = ids.length
    ? await db
        .select({
          project: schema.projects,
          category: { slug: schema.categories.slug, name: schema.categories.name },
          photoCount: sql<number>`(select count(*)::int from photos p where p.project_id = ${schema.projects.id})`,
        })
        .from(schema.projects)
        .leftJoin(schema.categories, eq(schema.categories.id, schema.projects.categoryId))
        .where(inArray(schema.projects.id, ids))
    : [];
  const cards = await toCards(rows, "private");
  const notifications = await db.query.notifications.findMany({
    where: eq(schema.notifications.userId, user.id),
    orderBy: [desc(schema.notifications.createdAt)],
    limit: 10,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-line pb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Área do cliente</p>
          <h1 className="display mt-3 text-5xl md:text-7xl">Olá, {user.name.split(" ")[0]}</h1>
        </div>
        <form action={logout}>
          <button className="text-xs uppercase tracking-[0.16em] text-mist hover:text-paper">Sair</button>
        </form>
      </div>

      {notifications.length > 0 && (
        <section className="mt-10 border border-line p-5" aria-labelledby="notif">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="notif" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
              <Bell className="size-4 text-lilac" aria-hidden /> Notificações {unread > 0 && <span className="bg-violet px-1.5 text-white">{unread}</span>}
            </h2>
            {unread > 0 && (
              <form action={markNotificationsRead}>
                <button className="text-xs text-lilac hover:underline">Marcar como lidas</button>
              </form>
            )}
          </div>
          <ul className="divide-y divide-line text-sm">
            {notifications.map((n) => (
              <li key={n.id} className="py-2">
                {n.link ? <Link href={n.link} className={n.readAt ? "" : "font-semibold"}>{n.title}</Link> : <span>{n.title}</span>}
                <span className="block text-xs text-mist">{n.body} · {formatDateTime(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12" aria-labelledby="galerias">
        <h2 id="galerias" className="eyebrow mb-6">Suas galerias</h2>
        {cards.length === 0 ? (
          <p className="border border-dashed border-line-strong p-10 text-center text-mist">
            Nenhuma galeria liberada ainda. Quando a fotógrafa liberar o acesso para o e-mail <strong>{user.email}</strong>, ela aparecerá aqui.
          </p>
        ) : (
          <ul className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => {
              const p = rows.find((r) => r.project.id === c.id)!.project;
              const stageIdx = p.clientStage ? ORDER.indexOf(p.clientStage) : -1;
              return (
                <li key={c.id}>
                  <Link href={`/cliente/projetos/${c.id}`} className="group block">
                    <div className="relative aspect-[4/3] overflow-hidden bg-ink-2">
                      {c.cover && <Picture photo={c.cover} fill sizes="(min-width: 1280px) 33vw, 50vw" imgClassName="transition-transform duration-700 group-hover:scale-[1.03]" />}
                    </div>
                    <h3 className="mt-4 text-xl font-bold uppercase [font-stretch:85%] group-hover:text-lilac">{c.title}</h3>
                    <p className="text-sm text-mist">{c.photoCount} fotografias</p>
                  </Link>
                  {p.clientStage && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-[0.14em]">Etapa: <strong>{STAGE[p.clientStage]}</strong></p>
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {ORDER.map((s, i) => (
                          <span key={s} className={`h-1 flex-1 ${i <= stageIdx ? "bg-violet" : "bg-line"}`} />
                        ))}
                      </div>
                      {p.deliveryDate && <p className="mt-2 text-xs text-mist">Entrega prevista: {formatDate(p.deliveryDate)}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-20 grid gap-10 border-t border-line pt-10 md:grid-cols-2" aria-label="Conta">
        <div>
          <h2 className="eyebrow mb-4">Alterar senha</h2>
          <ActionForm action={changePassword} submitLabel="Alterar senha" className="max-w-sm">
            <input name="current" type="password" autoComplete="current-password" placeholder="Senha atual" className="field" aria-label="Senha atual" />
            <input name="password" type="password" autoComplete="new-password" placeholder="Nova senha" className="field" aria-label="Nova senha" />
          </ActionForm>
        </div>
        <div>
          <h2 className="eyebrow mb-4">Privacidade</h2>
          <p className="mb-4 max-w-md text-sm text-mist">
            Você pode excluir sua conta a qualquer momento. Favoritas, aprovações e acessos serão removidos. Fotografias entregues continuam
            com a fotógrafa conforme contrato.
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-danger">Excluir minha conta</summary>
            <ActionForm action={deleteMyAccount} submitLabel="Excluir definitivamente" className="mt-4 max-w-sm">
              <input name="password" type="password" autoComplete="current-password" placeholder="Confirme com sua senha" className="field" aria-label="Senha" />
            </ActionForm>
          </details>
        </div>
      </section>
    </>
  );
}
