"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ImagePlus, Loader2, RotateCcw, Star, Trash2, Upload, X } from "lucide-react";
import type { PhotoView } from "@/lib/photos";
import { createBatch, movePhotos, removePhotos, reorderPhotos, setCover, updatePhoto } from "@/server/admin/portfolio-actions";
import { cn } from "@/lib/utils";

export type AdminPhoto = PhotoView & {
  originalName: string;
  bytes: number;
  qualityScore: number | null;
  sharpness: number | null;
  batchName: string | null;
  pendingAi: boolean;
};

type UploadItem = { file: File; status: "queued" | "uploading" | "done" | "error"; error?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/tiff,image/heic,image/heif,image/avif";

export function PhotoManager({
  projectId,
  coverId,
  photos: initial,
  projects,
  maxMb,
}: {
  projectId: string;
  coverId: string | null;
  photos: AdminPhoto[];
  projects: { id: string; title: string }[];
  maxMb: number;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminPhoto | null>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [batchName, setBatchName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // sincroniza quando o servidor reenvia a lista
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setPhotos(initial);
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const persistOrder = (list: AdminPhoto[]) => {
    setPhotos(list);
    start(async () => {
      await reorderPhotos(projectId, list.map((p) => p.id));
    });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const list = [...photos];
    [list[i], list[j]] = [list[j], list[i]];
    persistOrder(list);
  };

  const addFiles = (files: FileList | File[]) => {
    const items: UploadItem[] = Array.from(files).map((file) =>
      file.size > maxMb * 1024 * 1024
        ? { file, status: "error", error: `Acima de ${maxMb} MB` }
        : !/^image\//.test(file.type) && !/\.(heic|heif|tif|tiff)$/i.test(file.name)
          ? { file, status: "error", error: "Não é uma imagem" }
          : { file, status: "queued" },
    );
    setQueue((q) => [...q, ...items]);
  };

  const runUpload = async () => {
    setUploading(true);
    setMsg(null);
    const batchId = await createBatch(projectId, batchName);
    let index = 0;
    const snapshot = queue;
    const worker = async () => {
      while (index < snapshot.length) {
        const i = index++;
        if (snapshot[i].status !== "queued" && snapshot[i].status !== "error") continue;
        if (snapshot[i].error?.startsWith("Acima") || snapshot[i].error === "Não é uma imagem") continue;
        setQueue((q) => q.map((it, k) => (k === i ? { ...it, status: "uploading", error: undefined } : it)));
        const fd = new FormData();
        fd.append("file", snapshot[i].file);
        fd.append("projectId", projectId);
        fd.append("batchId", batchId);
        try {
          const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
          setQueue((q) => q.map((it, k) => (k === i ? { ...it, status: "done" } : it)));
        } catch (e) {
          setQueue((q) => q.map((it, k) => (k === i ? { ...it, status: "error", error: e instanceof Error ? e.message : "Falha" } : it)));
        }
      }
    };
    await Promise.all([worker(), worker()]); // 2 envios simultâneos
    setUploading(false);
    router.refresh();
  };

  const doneCount = queue.filter((q) => q.status === "done").length;
  const sel = [...selected];

  return (
    <div className="space-y-6">
      {/* UPLOAD ------------------------------------------------------------ */}
      <section className="border border-line bg-ink p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-mist">Enviar fotografias</h2>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-3 border border-dashed border-line-strong px-6 py-10 text-center"
        >
          <ImagePlus className="size-8 text-lilac" aria-hidden />
          <p className="text-sm">Arraste as fotos aqui ou</p>
          <button type="button" onClick={() => fileInput.current?.click()} className="bg-paper px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-violet hover:text-white">
            Escolher arquivos
          </button>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} aria-label="Escolher fotografias" />
          <p className="text-xs text-mist">JPEG, PNG, WebP, TIFF, HEIC ou AVIF · até {maxMb} MB cada · o original é preservado; o site gera versões AVIF/WebP otimizadas.</p>
        </div>
        {queue.length > 0 && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="min-w-56 flex-1">
                <span className="label">Nome do lote (organização)</span>
                <input value={batchName} onChange={(e) => setBatchName(e.target.value)} className="input" placeholder="Ex.: Largada — câmera 2" />
              </label>
              <button
                type="button"
                disabled={uploading || !queue.some((q) => q.status === "queued" || (q.status === "error" && !q.error?.startsWith("Acima")))}
                onClick={runUpload}
                className="inline-flex h-9 items-center gap-2 bg-violet px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {queue.some((q) => q.status === "error") && !uploading ? "Enviar / tentar novamente" : "Enviar"}
              </button>
              <button type="button" onClick={() => setQueue([])} disabled={uploading} className="h-9 px-3 text-xs text-mist hover:text-paper">
                Limpar lista
              </button>
            </div>
            <p className="mb-2 text-xs text-mist" aria-live="polite">
              {doneCount} de {queue.length} enviadas
            </p>
            <div className="h-1 bg-line">
              <div className="h-1 bg-violet transition-all" style={{ width: `${(doneCount / queue.length) * 100}%` }} />
            </div>
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
              {queue.map((q, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate">{q.file.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs">
                    {q.status === "queued" && <span className="text-mist">na fila</span>}
                    {q.status === "uploading" && <Loader2 className="size-3.5 animate-spin text-lilac" />}
                    {q.status === "done" && <CheckCircle2 className="size-3.5 text-ok" />}
                    {q.status === "error" && (
                      <span className="flex items-center gap-1 text-danger">
                        <AlertCircle className="size-3.5" /> {q.error}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* BARRA DE AÇÕES ---------------------------------------------------- */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 border border-line bg-ink/95 p-3 text-sm backdrop-blur">
        <span className="text-mist">{photos.length} fotos · {selected.size} selecionadas</span>
        <button type="button" className="text-xs text-lilac hover:underline" onClick={() => setSelected(new Set(selected.size === photos.length ? [] : photos.map((p) => p.id)))}>
          {selected.size === photos.length ? "Limpar seleção" : "Selecionar todas"}
        </button>
        {selected.size > 0 && (
          <>
            <select
              className="input w-auto py-1 text-xs"
              defaultValue=""
              aria-label="Mover selecionadas para"
              onChange={(e) => {
                const to = e.target.value;
                if (!to) return;
                start(async () => {
                  const r = await movePhotos(projectId, sel, to);
                  setMsg("error" in r ? (r.error ?? null) : `${r.moved} fotos movidas.`);
                  setSelected(new Set());
                  router.refresh();
                });
              }}
            >
              <option value="">Mover para…</option>
              {projects.filter((p) => p.id !== projectId).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center gap-1 border border-danger/50 px-3 py-1 text-xs text-danger hover:bg-danger hover:text-white"
              onClick={() => {
                if (!confirm(`Excluir ${selected.size} fotografia(s)? Os arquivos originais também serão removidos.`)) return;
                start(async () => {
                  const r = await removePhotos(projectId, sel);
                  setMsg(`${r.removed} fotos excluídas.`);
                  setSelected(new Set());
                  router.refresh();
                });
              }}
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-lilac" aria-label="Salvando" />}
        {msg && <span className="text-xs text-ok" role="status">{msg}</span>}
        <span className="ml-auto hidden text-xs text-mist md:inline">Arraste para reordenar</span>
      </div>

      {/* GRADE -------------------------------------------------------------- */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {photos.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={() => (dragId.current = p.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = photos.findIndex((x) => x.id === dragId.current);
              if (from < 0 || from === i) return;
              const list = [...photos];
              const [m] = list.splice(from, 1);
              list.splice(i, 0, m);
              persistOrder(list);
            }}
            className={cn("group relative border bg-ink", selected.has(p.id) ? "border-violet ring-2 ring-violet" : "border-line")}
          >
            <button type="button" onClick={() => setEditing(p)} className="block aspect-square w-full overflow-hidden bg-ink-2" aria-label={`Editar ${p.originalName}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.srcMedium} alt={p.alt} loading="lazy" className="h-full w-full object-cover" />
            </button>
            <label className="absolute left-2 top-2 grid size-7 place-items-center bg-ink/90">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-violet" aria-label={`Selecionar ${p.originalName}`} />
            </label>
            {p.id === coverId && <span className="absolute right-2 top-2 bg-violet px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-white">Capa</span>}
            {p.pendingAi && <span className="absolute bottom-12 right-2 bg-paper px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-ink">Sugestão IA</span>}
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[0.68rem]">
              <span className="truncate text-mist" title={p.originalName}>{p.originalName}</span>
              <span className="flex shrink-0 items-center">
                {p.qualityScore !== null && (
                  <span className={cn("mr-1 tabular-nums", p.qualityScore >= 60 ? "text-ok" : p.qualityScore >= 40 ? "text-amber-600" : "text-danger")} title="Nota técnica (nitidez/exposição)">
                    {Math.round(p.qualityScore)}
                  </span>
                )}
                <button type="button" onClick={() => move(i, -1)} className="p-0.5 hover:text-lilac" aria-label="Mover para trás"><ArrowUp className="size-3.5 -rotate-90" /></button>
                <button type="button" onClick={() => move(i, 1)} className="p-0.5 hover:text-lilac" aria-label="Mover para frente"><ArrowDown className="size-3.5 -rotate-90" /></button>
                <button type="button" onClick={() => start(async () => { await setCover(projectId, p.id); router.refresh(); })} className="p-0.5 hover:text-lilac" aria-label="Definir como capa"><Star className="size-3.5" /></button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {photos.length === 0 && <p className="border border-dashed border-line-strong p-8 text-center text-sm text-mist">Nenhuma fotografia neste projeto ainda.</p>}

      {/* EDIÇÃO -------------------------------------------------------------- */}
      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Editar fotografia" className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setEditing(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-md overflow-y-auto bg-ink p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const payload = { id: editing.id, caption: String(fd.get("caption")), alt: String(fd.get("alt")), tags: String(fd.get("tags")) };
              start(async () => {
                await updatePhoto(payload);
                setPhotos((list) =>
                  list.map((x) => (x.id === editing.id ? { ...x, caption: payload.caption || null, alt: payload.alt || x.alt, tags: payload.tags.split(",").map((t) => t.trim()).filter(Boolean) } : x)),
                );
                setEditing(null);
                router.refresh();
              });
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Editar fotografia</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Fechar"><X className="size-5" /></button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={editing.srcMedium} alt="" className="mb-4 w-full" />
            <dl className="mb-4 grid grid-cols-2 gap-1 text-xs text-mist">
              <dt>Original</dt><dd className="truncate">{editing.originalName}</dd>
              <dt>Dimensões</dt><dd>{editing.width}×{editing.height}</dd>
              <dt>Tamanho</dt><dd>{(editing.bytes / 1024 / 1024).toFixed(1)} MB</dd>
              <dt>Lote</dt><dd>{editing.batchName ?? "—"}</dd>
              <dt>Nota técnica</dt><dd>{editing.qualityScore ?? "—"} / 100</dd>
            </dl>
            <label className="mb-3 block">
              <span className="label">Legenda</span>
              <textarea name="caption" defaultValue={editing.caption ?? ""} rows={2} className="input" />
            </label>
            <label className="mb-3 block">
              <span className="label">Texto alternativo (acessibilidade)</span>
              <textarea name="alt" defaultValue={editing.alt === "Fotografia" ? "" : editing.alt} rows={2} className="input" />
            </label>
            <label className="mb-5 block">
              <span className="label">Etiquetas (separadas por vírgula)</span>
              <input name="tags" defaultValue={editing.tags.join(", ")} className="input" />
            </label>
            <button className="inline-flex h-9 items-center gap-2 bg-paper px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-violet hover:text-white">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="hidden" />} Salvar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
