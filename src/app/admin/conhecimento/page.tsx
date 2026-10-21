import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteKnowledge, saveKnowledge } from "@/server/admin/content-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";

export const metadata = { title: "Base do assistente" };

function Fields({ k }: { k?: typeof schema.knowledgeBase.$inferSelect }) {
  return (
    <>
      {k && <input type="hidden" name="id" value={k.id} />}
      <label className="block"><span className="label">Pergunta / tema</span><input name="title" defaultValue={k?.title} required className="input" /></label>
      <label className="block"><span className="label">Resposta autorizada</span><textarea name="content" rows={4} defaultValue={k?.content} required className="input" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={k?.published ?? true} className="accent-violet" /> Disponível para o assistente</label>
    </>
  );
}

export default async function KnowledgeAdmin() {
  await requireAdmin();
  const list = await db.query.knowledgeBase.findMany({ orderBy: [asc(schema.knowledgeBase.title)] });
  return (
    <>
      <PageHeader
        title="Base do assistente virtual"
        description="O assistente responde somente com base nestas informações, nos serviços cadastrados e nos dados de contato. Inclua aqui políticas (deslocamento, prazos, pagamento, direitos de imagem) — sem elas, ele encaminha a dúvida para você."
      />
      <Panel title="Nova informação" className="mb-6">
        <ActionForm action={saveKnowledge} submitLabel="Adicionar" className="space-y-3"><Fields /></ActionForm>
      </Panel>
      <div className="space-y-3">
        {list.map((k) => (
          <details key={k.id} className="border border-line bg-ink">
            <summary className="cursor-pointer px-5 py-3 font-medium">{k.title} {!k.published && <span className="text-xs text-mist">(oculto)</span>}</summary>
            <div className="border-t border-line p-5">
              <ActionForm action={saveKnowledge} submitLabel="Salvar" className="space-y-3"><Fields k={k} /></ActionForm>
              <form action={deleteKnowledge} className="mt-3"><input type="hidden" name="id" value={k.id} /><SubmitButton variant="danger">Excluir</SubmitButton></form>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
