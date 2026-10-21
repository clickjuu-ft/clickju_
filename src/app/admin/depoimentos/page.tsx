import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteTestimonial, saveTestimonial } from "@/server/admin/content-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton, Empty } from "@/components/admin/ui";

export const metadata = { title: "Depoimentos" };

function Fields({ t }: { t?: typeof schema.testimonials.$inferSelect }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_100px]">
        <label><span className="label">Autor</span><input name="author" defaultValue={t?.author} required className="input" /></label>
        <label><span className="label">Contexto</span><input name="context" defaultValue={t?.context ?? ""} className="input" placeholder="Ex.: Corrida X, 2026" /></label>
        <label><span className="label">Ordem</span><input name="sort" type="number" min={0} defaultValue={t?.sort ?? 0} className="input" /></label>
      </div>
      <label className="block"><span className="label">Depoimento</span><textarea name="quote" rows={3} defaultValue={t?.quote} required className="input" /></label>
      <div className="space-y-1 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={t?.published} className="accent-violet" /> Publicado na página inicial</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="authorized" defaultChecked={!!t} className="accent-violet" /> Confirmo que o depoimento é real e autorizado pelo autor</label>
      </div>
    </>
  );
}

export default async function TestimonialsAdmin() {
  await requireAdmin();
  const list = await db.query.testimonials.findMany({ orderBy: [asc(schema.testimonials.sort)] });
  return (
    <>
      <PageHeader title="Depoimentos" description="A seção de depoimentos da página inicial só aparece quando houver depoimentos publicados." />
      <Panel title="Novo depoimento" className="mb-6">
        <ActionForm action={saveTestimonial} submitLabel="Adicionar" className="space-y-3"><Fields /></ActionForm>
      </Panel>
      {list.length === 0 && <Empty>Nenhum depoimento cadastrado.</Empty>}
      <div className="space-y-3">
        {list.map((t) => (
          <details key={t.id} className="border border-line bg-ink">
            <summary className="cursor-pointer px-5 py-3"><span className="font-medium">{t.author}</span> <span className="text-xs text-mist">{t.published ? "publicado" : "oculto"}</span></summary>
            <div className="border-t border-line p-5">
              <ActionForm action={saveTestimonial} submitLabel="Salvar" className="space-y-3"><Fields t={t} /></ActionForm>
              <form action={deleteTestimonial} className="mt-3"><input type="hidden" name="id" value={t.id} /><SubmitButton variant="danger">Excluir</SubmitButton></form>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
