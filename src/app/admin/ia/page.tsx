import Link from "next/link";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { storage } from "@/lib/storage";
import { toView, type PhotoView } from "@/lib/photos";
import { aiEnabled } from "@/lib/ai/claude";
import { embeddingsEnabled, embedQuery } from "@/lib/ai/embeddings";
import { groupSimilar, heuristicSequence, suggestSelection } from "@/lib/ai/similarity";
import { suggestSequence, type PhotoMetadata } from "@/lib/ai/vision";
import { cosine } from "@/lib/images/process";
import { LOCAL_TOOLS, REMOTE_TOOLS, remoteToolAvailable } from "@/lib/ai/image-tools";
import { analyzeProject, applySequence, createCollection, deleteCollection, embedProject, reviewSuggestion, runTool } from "@/server/admin/ai-actions";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel, SubmitButton, Empty } from "@/components/admin/ui";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Inteligência artificial" };

function Thumb({ v, score, best }: { v: PhotoView; score?: number | null; best?: boolean }) {
  return (
    <figure className={cn("relative", best && "ring-2 ring-violet")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={v.srcMedium} alt={v.alt} loading="lazy" className="aspect-square w-full object-cover" />
      {score !== undefined && score !== null && (
        <figcaption className="absolute bottom-1 right-1 bg-black/70 px-1.5 text-[0.65rem] tabular-nums text-white">{Math.round(score)}</figcaption>
      )}
      {best && <span className="absolute left-1 top-1 bg-violet px-1.5 text-[0.6rem] font-bold uppercase text-white">Sugerida</span>}
    </figure>
  );
}

export default async function AiPage(props: PageProps<"/admin/ia">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const projects = await db.query.projects.findMany({ orderBy: [asc(schema.projects.title)], columns: { id: true, title: true } });
  const projectId = typeof sp.projeto === "string" && projects.some((p) => p.id === sp.projeto) ? sp.projeto : projects[0]?.id;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const seqId = typeof sp.sequencia === "string" ? sp.sequencia : "";

  if (!projectId) return <Empty>Crie um projeto primeiro.</Empty>;

  const photos = await db.query.photos.findMany({ where: eq(schema.photos.projectId, projectId), orderBy: [asc(schema.photos.sort)] });
  const views = new Map(await Promise.all(photos.map(async (p) => [p.id, await toView(p, "private")] as const)));
  const ids = photos.map((p) => p.id);
  const [suggestions, collections, jobs] = await Promise.all([
    ids.length
      ? db.query.aiSuggestions.findMany({ where: and(inArray(schema.aiSuggestions.photoId, ids), eq(schema.aiSuggestions.status, "pending")), orderBy: [asc(schema.aiSuggestions.createdAt)] })
      : [],
    db.query.collections.findMany({ where: eq(schema.collections.projectId, projectId), orderBy: [desc(schema.collections.createdAt)] }),
    ids.length ? db.query.imageJobs.findMany({ where: inArray(schema.imageJobs.photoId, ids), orderBy: [desc(schema.imageJobs.createdAt)], limit: 30 }) : [],
  ]);
  const jobLinks = await Promise.all(
    jobs.map(async (j) => ({
      ...j,
      url: j.outputKey ? await storage().signedUrl(j.outputKey, { access: "private", download: `${j.tool}-${j.photoId.slice(0, 8)}.${j.outputKey.split(".").pop()}` }) : null,
    })),
  );

  // Similaridade e seleção (local)
  const groups = groupSimilar(photos);
  const multi = groups.filter((g) => g.length > 1);
  const selection = suggestSelection(groups);

  // Busca
  let results: { id: string; score?: number }[] = [];
  let searchMode = "";
  if (q) {
    const withEmb = photos.filter((p) => p.embedding);
    if (embeddingsEnabled() && withEmb.length) {
      try {
        const e = await embedQuery(q);
        results = withEmb.map((p) => ({ id: p.id, score: cosine(e, p.embedding!) })).sort((a, b) => b.score! - a.score!).slice(0, 24);
        searchMode = "semântica por imagem (Voyage)";
      } catch (err) {
        searchMode = `falha na busca semântica (${err instanceof Error ? err.message : err}); usando texto`;
      }
    }
    if (!results.length) {
      const rows = await db.execute<{ id: string; rank: number }>(sql`
        select id, ts_rank(to_tsvector('portuguese'::regconfig, search_text), plainto_tsquery('portuguese', ${q})) as rank
        from photos where project_id = ${projectId}
          and (to_tsvector('portuguese'::regconfig, search_text) @@ plainto_tsquery('portuguese', ${q}) or search_text ilike ${`%${q}%`})
        order by rank desc limit 24`);
      results = rows.map((r) => ({ id: r.id }));
      searchMode ||= "textual (legendas, texto alternativo e etiquetas)";
    }
  }

  // Sequência narrativa sugerida (sob demanda)
  let sequence: { collectionId: string; order: string[]; rationale: string; mode: string } | null = null;
  if (seqId) {
    const c = collections.find((x) => x.id === seqId);
    if (c && c.photoIds.length) {
      const items = photos.filter((p) => c.photoIds.includes(p.id));
      if (aiEnabled()) {
        try {
          const sug = await db.query.aiSuggestions.findMany({ where: and(inArray(schema.aiSuggestions.photoId, c.photoIds), isNotNull(schema.aiSuggestions.payload)) });
          const r = await suggestSequence(
            items.map((p) => ({
              id: p.id,
              caption: p.caption ?? (sug.find((s) => s.photoId === p.id)?.payload as PhotoMetadata | undefined)?.caption ?? "",
              scene: (sug.find((s) => s.photoId === p.id)?.payload as PhotoMetadata | undefined)?.scene ?? p.tags.join(", "),
              takenAt: p.takenAt?.toISOString() ?? null,
              quality: p.qualityScore,
            })),
          );
          sequence = { collectionId: c.id, ...r, mode: "IA (Claude)" };
        } catch (err) {
          sequence = { collectionId: c.id, order: heuristicSequence(items, groups), rationale: `IA indisponível (${err instanceof Error ? err.message : err}). Ordem heurística: cronológica, evitando fotos semelhantes em sequência.`, mode: "heurística" };
        }
      } else {
        sequence = { collectionId: c.id, order: heuristicSequence(items, groups), rationale: "Ordem heurística (IA não configurada): cronológica pela data de captura, evitando fotos semelhantes em sequência.", mode: "heurística" };
      }
    }
  }

  return (
    <>
      <PageHeader title="Inteligência artificial" description="Organização assistida das fotografias. Nenhuma alteração é aplicada sem a sua revisão; arquivos originais nunca são modificados.">
        <form className="flex gap-2">
          <select name="projeto" defaultValue={projectId} className="input w-auto" aria-label="Projeto">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <button className="h-9 bg-paper px-4 text-xs font-semibold uppercase text-ink">Abrir</button>
        </form>
      </PageHeader>

      <div className="mb-6 grid gap-2 text-sm md:grid-cols-3">
        {[
          ["Legendas, etiquetas e sequência (Claude)", aiEnabled(), "ANTHROPIC_API_KEY"],
          ["Busca semântica por imagem (Voyage)", embeddingsEnabled(), "VOYAGE_API_KEY"],
          ["Similaridade, nota técnica e recortes (local)", true, ""],
        ].map(([l, ok, env]) => (
          <p key={String(l)} className="flex items-center gap-2 border border-line bg-ink px-3 py-2">
            {ok ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <AlertTriangle className="size-4 text-amber-600" aria-hidden />}
            <span>{l}</span>
            {!ok && <span className="ml-auto font-mono text-[0.65rem] text-mist">{env}</span>}
          </p>
        ))}
      </div>

      <div className="space-y-6">
        <Panel title={`1. Legendas e etiquetas sugeridas (${suggestions.length} aguardando revisão)`}>
          <ActionForm action={analyzeProject} submitLabel="Analisar próximas fotos com IA" pendingLabel="Analisando… (pode levar alguns segundos por foto)" className="mb-6 flex flex-wrap items-end gap-3 space-y-0 [&>button]:w-auto">
            <input type="hidden" name="projectId" value={projectId} />
            <label><span className="label">Quantidade</span><select name="limit" className="input w-24" defaultValue="10"><option>5</option><option>10</option><option>20</option></select></label>
          </ActionForm>
          {suggestions.length === 0 ? (
            <p className="text-sm text-mist">Nenhuma sugestão pendente.</p>
          ) : (
            <ul className="space-y-4">
              {suggestions.map((s) => {
                const m = s.payload as PhotoMetadata;
                const v = views.get(s.photoId);
                return (
                  <li key={s.id} className="grid gap-4 border border-line p-4 md:grid-cols-[160px_1fr]">
                    {v && <Thumb v={v} />}
                    <form action={reviewSuggestion} className="space-y-2">
                      <input type="hidden" name="id" value={s.id} />
                      <label className="block"><span className="label">Legenda</span><input name="caption" defaultValue={m.caption} className="input" /></label>
                      <label className="block"><span className="label">Texto alternativo</span><input name="alt" defaultValue={m.alt} className="input" /></label>
                      <label className="block"><span className="label">Etiquetas</span><input name="tags" defaultValue={m.tags.join(", ")} className="input" /></label>
                      <p className="text-xs text-mist">Cena: {m.scene || "—"} · Modalidade: {m.sport || "—"} · Categoria sugerida: {m.category_slug || "—"} · {s.model}</p>
                      {m.category_slug && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="applyCategory" className="accent-violet" /> Aplicar categoria ao projeto</label>}
                      <div className="flex gap-2">
                        <SubmitButton name="decision" value="accept" variant="violet">Aceitar</SubmitButton>
                        <SubmitButton name="decision" value="reject" variant="ghost">Rejeitar</SubmitButton>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="2. Busca por descrição de cena ou modalidade">
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="projeto" value={projectId} />
            <input name="q" defaultValue={q} placeholder="Ex.: largada, chegada emocionada, contraluz, ciclismo" className="input max-w-lg flex-1" aria-label="Buscar" />
            <button className="h-9 bg-paper px-4 text-xs font-semibold uppercase text-ink">Buscar</button>
          </form>
          {embeddingsEnabled() && (
            <ActionForm action={embedProject} submitLabel="Indexar fotos para busca semântica" className="mb-4 space-y-0 [&>button]:w-auto">
              <input type="hidden" name="projectId" value={projectId} />
            </ActionForm>
          )}
          {q && (
            <>
              <p className="mb-3 text-xs text-mist">{results.length} resultado(s) · busca {searchMode}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-8">
                {results.map((r) => views.get(r.id) && <Thumb key={r.id} v={views.get(r.id)!} />)}
              </div>
            </>
          )}
        </Panel>

        <Panel title={`3. Imagens semelhantes e sugestão de seleção (${multi.length} grupos)`}>
          <p className="mb-4 text-xs text-mist">
            Calculado localmente (hash perceptual, histograma de cor{embeddingsEnabled() ? " e embeddings" : ""}). A nota (0–100) é técnica — nitidez e exposição —
            e não substitui o seu olhar: fotos low-key intencionais podem ter nota baixa.
          </p>
          {multi.length === 0 ? (
            <p className="text-sm text-mist">Nenhum grupo de fotos semelhantes encontrado.</p>
          ) : (
            <div className="space-y-4">
              {multi.slice(0, 12).map((g, i) => (
                <div key={i}>
                  <p className="mb-1 text-xs text-mist">Grupo {i + 1} · {g.length} fotos</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-10">
                    {g.map((p, k) => views.get(p.id) && <Thumb key={p.id} v={views.get(p.id)!} score={p.qualityScore} best={k === 0} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <form action={createCollection} className="mt-6 border-t border-line pt-4">
            <input type="hidden" name="projectId" value={projectId} />
            <p className="mb-2 text-sm">Seleção sugerida: a melhor de cada grupo ({selection.length} fotos). Desmarque o que não quiser e crie a coleção.</p>
            <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-10">
              {selection.map((p) =>
                views.get(p.id) ? (
                  <label key={p.id} className="relative block cursor-pointer">
                    <Thumb v={views.get(p.id)!} score={p.qualityScore} />
                    <input type="checkbox" name="photoIds" value={p.id} defaultChecked className="absolute left-1 top-1 size-4 accent-violet" aria-label="Incluir" />
                  </label>
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input name="name" defaultValue="Seleção sugerida" className="input max-w-xs" aria-label="Nome da coleção" />
              <SubmitButton>Criar coleção</SubmitButton>
            </div>
          </form>
        </Panel>

        <Panel title="4. Coleções e sequência narrativa">
          <span id="colecoes" />
          {collections.length === 0 ? (
            <p className="text-sm text-mist">Nenhuma coleção. Crie a partir da seleção sugerida acima.</p>
          ) : (
            <ul className="space-y-4">
              {collections.map((c) => (
                <li key={c.id} className="border border-line p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{c.name} <span className="text-xs text-mist">{c.photoIds.length} fotos · {formatDateTime(c.createdAt)}</span></p>
                    <div className="flex gap-2">
                      <Link href={`/admin/ia?projeto=${projectId}&sequencia=${c.id}#colecoes`} className="inline-flex h-9 items-center border border-line-strong px-3 text-xs uppercase tracking-[0.12em] hover:border-paper">Sugerir sequência</Link>
                      <a href={`/api/admin/projects/${projectId}/selection`} className="inline-flex h-9 items-center border border-line-strong px-3 text-xs uppercase tracking-[0.12em] hover:border-paper">Exportar lista</a>
                      <form action={deleteCollection}><input type="hidden" name="id" value={c.id} /><SubmitButton variant="danger">Excluir</SubmitButton></form>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1 sm:grid-cols-10 xl:grid-cols-14">
                    {c.photoIds.map((pid) => views.get(pid) && <Thumb key={pid} v={views.get(pid)!} />)}
                  </div>
                  {sequence?.collectionId === c.id && (
                    <form action={applySequence} className="mt-4 border-t border-line pt-4">
                      <input type="hidden" name="collectionId" value={c.id} />
                      <input type="hidden" name="order" value={sequence.order.join(",")} />
                      <p className="mb-2 text-sm"><strong>Sequência sugerida</strong> ({sequence.mode}): {sequence.rationale}</p>
                      <ol className="mb-3 grid grid-cols-6 gap-1 sm:grid-cols-10 xl:grid-cols-14">
                        {sequence.order.map((pid, i) => views.get(pid) && (
                          <li key={pid} className="relative"><Thumb v={views.get(pid)!} /><span className="absolute left-1 top-1 bg-black/70 px-1 text-[0.6rem] text-white">{i + 1}</span></li>
                        ))}
                      </ol>
                      <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" name="applyToGallery" className="accent-violet" /> Também reordenar a galeria publicada (fotos da coleção primeiro)</label>
                      <SubmitButton variant="violet">Confirmar e aplicar</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="5. Ferramentas de imagem">
          <p className="mb-4 text-xs text-mist">Cada operação gera um arquivo novo para download; o original e a galeria não são alterados.</p>
          <ActionForm action={runTool} submitLabel="Processar" pendingLabel="Processando…" className="grid gap-3 space-y-0 md:grid-cols-[1fr_1fr_auto] md:items-end [&>button]:h-9">
            <label>
              <span className="label">Fotografia</span>
              <select name="photoId" className="input">
                {photos.map((p) => <option key={p.id} value={p.id}>{p.originalName}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Ferramenta</span>
              <select name="tool" className="input">
                {Object.entries(LOCAL_TOOLS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                {Object.entries(REMOTE_TOOLS).map(([k, t]) => (
                  <option key={k} value={k} disabled={!remoteToolAvailable(k as keyof typeof REMOTE_TOOLS)}>
                    {t.label}{remoteToolAvailable(k as keyof typeof REMOTE_TOOLS) ? "" : " — não configurado"}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
          {jobLinks.length > 0 && (
            <ul className="mt-5 divide-y divide-line text-sm">
              <li className="pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Arquivos gerados</li>
              {jobLinks.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{(LOCAL_TOOLS as Record<string, { label: string }>)[j.tool]?.label ?? (REMOTE_TOOLS as Record<string, { label: string }>)[j.tool]?.label ?? j.tool} · {photos.find((p) => p.id === j.photoId)?.originalName}</span>
                  {j.status === "done" && j.url ? <a href={j.url} className="text-lilac hover:underline">Baixar</a> : <span className={j.status === "failed" ? "text-danger" : "text-mist"}>{j.status === "failed" ? `Falhou: ${j.error}` : "Processando"}</span>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
