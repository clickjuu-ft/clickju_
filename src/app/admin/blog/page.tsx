import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deletePost, savePost } from "@/server/admin/content-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Blog" };

function Fields({ p }: { p?: typeof schema.blogPosts.$inferSelect }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <label><span className="label">Título</span><input name="title" defaultValue={p?.title} required className="input" /></label>
        <label><span className="label">Endereço (slug)</span><input name="slug" defaultValue={p?.slug} className="input" placeholder="automático" /></label>
      </div>
      <label className="block"><span className="label">Resumo</span><input name="excerpt" defaultValue={p?.excerpt ?? ""} className="input" /></label>
      <label className="block"><span className="label">ID da foto de capa (opcional)</span><input name="coverPhotoId" defaultValue={p?.coverPhotoId ?? ""} className="input font-mono text-xs" /></label>
      <label className="block">
        <span className="label">Conteúdo</span>
        <textarea name="body" rows={12} defaultValue={p?.body} required className="input font-mono text-xs" />
        <span className="mt-1 block text-xs text-mist">Parágrafos separados por linha em branco · “## ” para títulos · “- ” para listas.</span>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={p?.published} className="accent-violet" /> Publicado</label>
    </>
  );
}

export default async function BlogAdmin() {
  await requireAdmin();
  const posts = await db.query.blogPosts.findMany({ orderBy: [desc(schema.blogPosts.createdAt)] });
  return (
    <>
      <PageHeader title="Blog" description="Opcional. O link “Blog” do menu mostra apenas posts publicados." />
      <Panel title="Novo post" className="mb-6">
        <ActionForm action={savePost} submitLabel="Criar post" className="space-y-3"><Fields /></ActionForm>
      </Panel>
      <div className="space-y-3">
        {posts.map((p) => (
          <details key={p.id} className="border border-line bg-ink">
            <summary className="cursor-pointer px-5 py-3"><span className="font-medium">{p.title}</span> <span className="text-xs text-mist">{p.published ? `publicado ${formatDate(p.publishedAt)}` : "rascunho"}</span></summary>
            <div className="border-t border-line p-5">
              <ActionForm action={savePost} submitLabel="Salvar" className="space-y-3"><Fields p={p} /></ActionForm>
              <form action={deletePost} className="mt-3"><input type="hidden" name="id" value={p.id} /><SubmitButton variant="danger">Excluir</SubmitButton></form>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
