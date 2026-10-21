import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteCategory, saveCategory } from "@/server/admin/content-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Categorias" };

function Fields({ c }: { c?: typeof schema.categories.$inferSelect }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_100px]">
        <label><span className="label">Nome</span><input name="name" defaultValue={c?.name} required className="input" /></label>
        <label><span className="label">Endereço (slug)</span><input name="slug" defaultValue={c?.slug} className="input" placeholder="automático" /></label>
        <label><span className="label">Ordem</span><input name="sort" type="number" min={0} defaultValue={c?.sort ?? 0} className="input" /></label>
      </div>
      <label className="block"><span className="label">Descrição</span><input name="description" defaultValue={c?.description ?? ""} className="input" /></label>
    </>
  );
}

export default async function CategoriesPage() {
  await requireAdmin();
  const cats = await db.query.categories.findMany({ orderBy: [asc(schema.categories.sort)] });
  return (
    <>
      <PageHeader title="Categorias do portfólio" description="Organizam os projetos e aparecem nos filtros do portfólio e na página inicial." />
      <Panel title="Nova categoria" className="mb-6">
        <ActionForm action={saveCategory} submitLabel="Adicionar" className="space-y-3"><Fields /></ActionForm>
      </Panel>
      <div className="space-y-3">
        {cats.map((c) => (
          <details key={c.id} className="border border-line bg-ink">
            <summary className="cursor-pointer px-5 py-3 font-medium">{c.name} <span className="ml-2 text-xs text-mist">/{c.slug}</span></summary>
            <div className="border-t border-line p-5">
              <ActionForm action={saveCategory} submitLabel="Salvar" className="space-y-3"><Fields c={c} /></ActionForm>
              <form action={deleteCategory} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton variant="danger">Excluir categoria</SubmitButton>
                <p className="mt-1 text-xs text-mist">Os projetos desta categoria ficam “sem categoria”.</p>
              </form>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
