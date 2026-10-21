import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, inArray, and } from "drizzle-orm";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { toView } from "@/lib/photos";
import { env } from "@/lib/env";
import { createShareLink, deleteProject, grantAccess, revokeAccess, revokeShareLink, updateProject } from "@/server/admin/portfolio-actions";
import { ActionForm } from "@/components/forms/action-form";
import { ShareLinkForm } from "@/components/admin/share-link-form";
import { PhotoManager } from "@/components/admin/photo-manager";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Projeto" };

const STAGES = [
  ["", "—"],
  ["agendado", "Agendado"],
  ["em_producao", "Em produção"],
  ["em_edicao", "Em edição"],
  ["selecao_cliente", "Seleção pelo cliente"],
  ["finalizando", "Finalizando"],
  ["entregue", "Entregue"],
];

export default async function ProjectAdmin(props: PageProps<"/admin/projetos/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!p) notFound();
  const [cats, photos, batches, links, access, allProjects] = await Promise.all([
    db.query.categories.findMany({ orderBy: [asc(schema.categories.sort)] }),
    db.query.photos.findMany({ where: eq(schema.photos.projectId, id), orderBy: [asc(schema.photos.sort), asc(schema.photos.createdAt)] }),
    db.query.uploadBatches.findMany({ where: eq(schema.uploadBatches.projectId, id) }),
    db.query.shareLinks.findMany({ where: eq(schema.shareLinks.projectId, id), orderBy: [desc(schema.shareLinks.createdAt)] }),
    db.query.projectAccess.findMany({ where: eq(schema.projectAccess.projectId, id), orderBy: [asc(schema.projectAccess.email)] }),
    db.query.projects.findMany({ columns: { id: true, title: true }, orderBy: [asc(schema.projects.title)] }),
  ]);
  const pendingAi = photos.length
    ? new Set(
        (
          await db.query.aiSuggestions.findMany({
            where: and(inArray(schema.aiSuggestions.photoId, photos.map((x) => x.id)), eq(schema.aiSuggestions.status, "pending")),
            columns: { photoId: true },
          })
        ).map((s) => s.photoId),
      )
    : new Set<string>();
  const views = await Promise.all(
    photos.map(async (ph) => ({
      ...(await toView(ph, "private")),
      originalName: ph.originalName,
      bytes: ph.bytes,
      qualityScore: ph.qualityScore,
      sharpness: ph.sharpness,
      batchName: batches.find((b) => b.id === ph.batchId)?.name ?? null,
      pendingAi: pendingAi.has(ph.id),
    })),
  );

  return (
    <>
      <Link href="/admin/projetos" className="mb-4 inline-flex items-center gap-1 text-sm text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Projetos
      </Link>
      <PageHeader title={p.title} description={`${photos.length} fotografias · ${p.published ? "publicado" : "rascunho (não aparece no site)"}`}>
        <Link href={`/portfolio/${p.slug}`} target="_blank" className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
          Ver galeria <ExternalLink className="size-3.5" aria-hidden />
        </Link>
        <a href={`/api/admin/projects/${p.id}/selection`} className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
          Exportar seleção (CSV)
        </a>
        <Link href={`/admin/ia?projeto=${p.id}`} className="inline-flex h-9 items-center gap-2 border border-line-strong px-4 text-xs font-semibold uppercase tracking-[0.12em] hover:border-paper">
          Ferramentas de IA
        </Link>
      </PageHeader>

      <div className="grid gap-6 2xl:grid-cols-[1fr_420px]">
        <PhotoManager projectId={p.id} coverId={p.coverPhotoId} photos={views} projects={allProjects} maxMb={env.uploadMaxMb} />

        <div className="space-y-6">
          <Panel title="Informações do projeto">
            <ActionForm action={updateProject} submitLabel="Salvar projeto" className="space-y-4">
              <input type="hidden" name="id" value={p.id} />
              <label className="block"><span className="label">Título</span><input name="title" defaultValue={p.title} required className="input" /></label>
              <label className="block"><span className="label">Endereço (slug)</span><input name="slug" defaultValue={p.slug} className="input" /></label>
              <label className="block"><span className="label">Resumo</span><input name="summary" defaultValue={p.summary ?? ""} className="input" /></label>
              <label className="block"><span className="label">Descrição</span><textarea name="description" rows={4} defaultValue={p.description ?? ""} className="input" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">Categoria</span>
                  <select name="categoryId" defaultValue={p.categoryId ?? ""} className="input">
                    <option value="">—</option>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="block"><span className="label">Ordem</span><input name="sort" type="number" min={0} defaultValue={p.sort} className="input" /></label>
                <label className="block"><span className="label">Evento</span><input name="eventName" defaultValue={p.eventName ?? ""} className="input" /></label>
                <label className="block"><span className="label">Data</span><input name="eventDate" type="date" defaultValue={p.eventDate ?? ""} className="input" /></label>
              </div>
              <label className="block"><span className="label">Local</span><input name="location" defaultValue={p.location ?? ""} className="input" /></label>
              <fieldset className="space-y-2 border-t border-line pt-4">
                <legend className="label">Visibilidade</legend>
                <select name="visibility" defaultValue={p.visibility} className="input">
                  <option value="public">Público — aparece no portfólio</option>
                  <option value="unlisted">Somente com o link</option>
                  <option value="password">Protegido por senha</option>
                  <option value="private">Privado — clientes autorizados</option>
                </select>
                <input name="password" type="password" autoComplete="new-password" className="input" placeholder={p.passwordHash ? "Senha definida — preencha para trocar" : "Senha (para “Protegido por senha”)"} />
              </fieldset>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={p.published} className="accent-violet" /> Publicado</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={p.featured} className="accent-violet" /> Destaque na página inicial</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="watermark" defaultChecked={p.watermark} className="accent-violet" /> Marca-d’água nas prévias (configurável em Configurações)</label>
              </div>
              <fieldset className="space-y-3 border-t border-line pt-4">
                <legend className="label">Entrega para o cliente</legend>
                <select name="clientStage" defaultValue={p.clientStage ?? ""} className="input" aria-label="Etapa">
                  {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input name="deliveryDate" type="date" defaultValue={p.deliveryDate ?? ""} className="input" aria-label="Data de entrega prevista" />
                <textarea name="deliveryInfo" rows={3} defaultValue={p.deliveryInfo ?? ""} className="input" placeholder="Informações sobre a entrega exibidas na Área do Cliente" />
              </fieldset>
            </ActionForm>
          </Panel>

          <Panel title="Acesso de clientes">
            <ul className="mb-4 space-y-2 text-sm">
              {access.length === 0 && <li className="text-mist">Nenhum cliente com acesso.</li>}
              {access.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{a.email}</span>
                    <span className="text-xs text-mist">
                      {a.userId ? "conta ativa" : "convite pendente"} · {a.canDownload ? "pode baixar" : "só visualizar"}
                      {a.canShare ? " · pode compartilhar" : ""}
                      {a.expiresAt ? ` · até ${formatDate(a.expiresAt)}` : ""}
                    </span>
                  </span>
                  <form action={revokeAccess}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="text-xs text-danger hover:underline">Revogar</button>
                  </form>
                </li>
              ))}
            </ul>
            <ActionForm action={grantAccess} submitLabel="Liberar acesso" className="space-y-3">
              <input type="hidden" name="projectId" value={p.id} />
              <input name="email" type="email" required placeholder="E-mail do cliente" className="input" aria-label="E-mail do cliente" />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="canDownload" className="accent-violet" /> Pode baixar</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="canShare" className="accent-violet" /> Pode convidar outras pessoas</label>
              </div>
              <select name="days" className="input" aria-label="Validade" defaultValue="0">
                <option value="0">Sem prazo</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
              </select>
            </ActionForm>
          </Panel>

          <Panel title="Links de compartilhamento">
            <ul className="mb-4 space-y-2 text-sm">
              {links.length === 0 && <li className="text-mist">Nenhum link criado.</li>}
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>
                    {l.label ?? "Link"}{" "}
                    <span className="text-xs text-mist">
                      {l.revokedAt ? "revogado" : l.expiresAt ? (l.expiresAt < new Date() ? "expirado" : `até ${formatDate(l.expiresAt)}`) : "sem prazo"}
                    </span>
                  </span>
                  {!l.revokedAt && (
                    <form action={revokeShareLink}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="text-xs text-danger hover:underline">Revogar</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <ShareLinkForm projectId={p.id} action={createShareLink} />
          </Panel>

          <Panel title="Excluir projeto">
            <form action={deleteProject} className="space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <p className="text-xs text-mist">Remove o projeto, as fotografias e os arquivos originais. Digite o título exato para confirmar.</p>
              {sp.erro === "confirmacao" && <p className="text-xs text-danger">O título digitado não confere.</p>}
              <input name="confirm" className="input" aria-label="Título para confirmar" />
              <SubmitButton variant="danger">Excluir definitivamente</SubmitButton>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
