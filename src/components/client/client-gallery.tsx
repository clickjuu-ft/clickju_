"use client";

import { useState, useTransition } from "react";
import { Gallery } from "@/components/portfolio/gallery";
import type { PhotoView } from "@/lib/photos";
import { setApproval, toggleFavorite } from "@/server/client-actions";
import { cn } from "@/lib/utils";

export function ClientGallery({
  photos,
  initialFavorites,
  initialApprovals,
  canDownload,
}: {
  photos: PhotoView[];
  initialFavorites: string[];
  initialApprovals: Record<string, "approved" | "rejected">;
  canDownload: boolean;
}) {
  const [favs, setFavs] = useState(new Set(initialFavorites));
  const [appr, setAppr] = useState(initialApprovals);
  const [filter, setFilter] = useState<"todas" | "favoritas" | "aprovadas">("todas");
  const [, start] = useTransition();

  const visible = photos.filter((p) => (filter === "favoritas" ? favs.has(p.id) : filter === "aprovadas" ? appr[p.id] === "approved" : true));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar">
        {(
          [
            ["todas", `Todas (${photos.length})`],
            ["favoritas", `Favoritas (${favs.size})`],
            ["aprovadas", `Aprovadas (${Object.values(appr).filter((v) => v === "approved").length})`],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
            className={cn("px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", filter === v ? "bg-paper text-ink" : "text-mist hover:text-paper")}
          >
            {l}
          </button>
        ))}
        <span className="ml-auto text-xs text-mist">Abra uma foto para favoritar, aprovar{canDownload ? " ou baixar" : ""}.</span>
      </div>
      <Gallery
        photos={visible}
        initialLayout="masonry"
        actions={{
          isFavorite: (id) => favs.has(id),
          onToggleFavorite: (id) => {
            setFavs((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            });
            start(async () => {
              await toggleFavorite(id);
            });
          },
          approval: (id) => appr[id],
          onApprove: (id, status) => {
            const next = appr[id] === status ? "none" : status;
            setAppr((a) => {
              const n = { ...a };
              if (next === "none") delete n[id];
              else n[id] = next;
              return n;
            });
            start(async () => {
              await setApproval(id, next);
            });
          },
          downloadHref: canDownload ? (id) => `/api/client/download/${id}` : undefined,
        }}
      />
    </div>
  );
}
