import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteService, saveService } from "@/server/admin/content-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";
import { formatBRL } from "@/lib/utils";

export const metadata = { title: "Serviços" };

function Fields({ s }: { s?: typeof schema.services.$inferSelect }) {
  return (
    <>
      {s && <input type="hidden" name="id" value={s.id} />}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_100px]">
        <label><span className="label">Nome</span><input name="name" defaultValue={s?.name} required className="input" /></label>
        <label><span className="label">Endereço (slug)</span><input name="slug" defaultValue={s?.slug} className="input" placeholder="automático" /></label>
        <label><span className="label">Ordem</span><input name="sort" type="number" min={0} defaultValue={s?.sort ?? 0} className="input" /></label>
      </div>
      <label className="block"><span className="label">Descrição curta</span><input name="description" defaultValue={s?.description ?? ""} className="input" /></label>
      <label className="block"><span className="label">O que a cobertura inclui</span><textarea name="coverage" rows={3} defaultValue={s?.coverage ?? ""} className="input" /></label>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <label><span className="label">Preço a partir de (R$)</span><input name="priceFrom" inputMode="decimal" defaultValue={s?.priceFrom ? String(s.priceFrom).replace(".", ",") : ""} className="input" placeholder="Opcional" /></label>
        <label><span className="label">Observação de preço</span><input name="priceNote" defaultValue={s?.priceNote ?? ""} className="input" placeholder="Ex.: valor para até 2 horas na capital" /></label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="showPrice" defaultChecked={s?.showPrice} className="accent-violet" /> Exibir preço no site e no assistente</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={s?.active ?? true} className="accent-violet" /> Ativo (aparece no formulário de orçamento)</label>
      </div>
    </>
  );
}

export default async function ServicesAdmin() {
  await requireAdmin();
  const list = await db.query.services.findMany({ orderBy: [asc(schema.services.sort)] });
  return (
    <>
      <PageHeader title="Serviços" description="São as opções do formulário de orçamento e da página Serviços. Preços só aparecem se você marcar “Exibir preço” — o assistente virtual nunca inventa valores." />
      <Panel title="Novo serviço" className="mb-6">
        <ActionForm action={saveService} submitLabel="Adicionar" className="space-y-3"><Fields /></ActionForm>
      </Panel>
      <div className="space-y-3">
        {list.map((s) => (
          <details key={s.id} className="border border-line bg-ink">
            <summary className="cursor-pointer px-5 py-3 font-medium">
              {s.name}
              <span className="ml-2 text-xs text-mist">
                {s.active ? "ativo" : "inativo"} · {s.showPrice && s.priceFrom ? `a partir de ${formatBRL(s.priceFrom)}` : "preço não exibido"}
              </span>
            </summary>
            <div className="border-t border-line p-5">
              <ActionForm action={saveService} submitLabel="Salvar" className="space-y-3"><Fields s={s} /></ActionForm>
              {s.active && (
                <form action={deleteService} className="mt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="danger">Desativar</SubmitButton>
                </form>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
