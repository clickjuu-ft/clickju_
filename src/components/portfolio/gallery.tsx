"use client";

import { useCallback, useEffect, useState } from "react";
import { Columns3, LayoutGrid, Heart, Check } from "lucide-react";
import { Picture } from "@/components/ui/picture";
import { Lightbox, type LightboxActions } from "@/components/portfolio/lightbox";
import type { PhotoView } from "@/lib/photos";
import { cn } from "@/lib/utils";

type Layout = "editorial" | "masonry";

/** Padrão editorial: ritmo assimétrico de linhas (1 grande, 2 médias, 3 menores...). */
const EDITORIAL_PATTERN = [
  "md:col-span-12 aspect-[16/9]",
  "md:col-span-7 aspect-[4/5]",
  "md:col-span-5 aspect-[4/5] md:mt-32",
  "md:col-span-4 aspect-[3/4]",
  "md:col-span-4 aspect-[3/4] md:mt-16",
  "md:col-span-4 aspect-[3/4]",
  "md:col-span-5 md:col-start-2 aspect-[4/5]",
  "md:col-span-5 aspect-[4/5] md:mt-24",
];

export function Gallery({
  photos,
  initialLayout = "editorial",
  actions,
  showToggle = true,
}: {
  photos: PhotoView[];
  initialLayout?: Layout;
  actions?: LightboxActions;
  showToggle?: boolean;
}) {
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [open, setOpen] = useState<number | null>(null);

  // link direto para uma fotografia: #foto-<id>
  useEffect(() => {
    const m = window.location.hash.match(/^#foto-(.+)$/);
    if (!m) return;
    const i = photos.findIndex((p) => p.id === m[1]);
    if (i < 0) return;
    const frame = requestAnimationFrame(() => setOpen(i));
    return () => cancelAnimationFrame(frame);
  }, [photos]);

  const setIndex = useCallback(
    (i: number | null) => {
      setOpen(i);
      const url = new URL(window.location.href);
      url.hash = i === null ? "" : `foto-${photos[i].id}`;
      window.history.replaceState(null, "", url);
    },
    [photos],
  );

  if (photos.length === 0) {
    return <p className="py-20 text-center text-mist">Nenhuma fotografia nesta galeria ainda.</p>;
  }

  const badge = (p: PhotoView) => {
    const fav = actions?.isFavorite?.(p.id);
    const appr = actions?.approval?.(p.id);
    if (!fav && !appr) return null;
    return (
      <span className="absolute right-2 top-2 flex gap-1">
        {fav && (
          <span className="grid size-7 place-items-center bg-black/60 text-white text-lilac backdrop-blur" title="Favorita">
            <Heart className="size-3.5 fill-current" />
          </span>
        )}
        {appr === "approved" && (
          <span className="grid size-7 place-items-center bg-black/60 text-white text-ok backdrop-blur" title="Aprovada">
            <Check className="size-3.5" />
          </span>
        )}
      </span>
    );
  };

  return (
    <div>
      {showToggle && (
        <div className="mb-8 flex items-center justify-between border-b border-line pb-4">
          <p className="text-sm text-mist">
            {photos.length} {photos.length === 1 ? "fotografia" : "fotografias"}
          </p>
          <div role="group" aria-label="Disposição da galeria" className="flex gap-1">
            {(
              [
                ["editorial", "Editorial", LayoutGrid],
                ["masonry", "Mosaico", Columns3],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
                className={cn(
                  "flex h-9 items-center gap-2 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] transition-colors",
                  layout === value ? "bg-paper text-ink" : "text-mist hover:text-paper",
                )}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {layout === "masonry" ? (
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4">
          {photos.map((p, i) => (
            <li key={p.id} className="break-inside-avoid">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className="group relative block w-full cursor-zoom-in"
                aria-label={`Ampliar: ${p.alt}`}
              >
                <Picture
                  photo={p}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  priority={i < 3}
                  imgClassName="transition-[transform,filter] duration-700 group-hover:scale-[1.02] group-hover:brightness-110"
                />
                {badge(p)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
          {photos.map((p, i) => (
            <li key={p.id} className={cn("relative", EDITORIAL_PATTERN[i % EDITORIAL_PATTERN.length].split(" ").filter((c) => c.startsWith("md:")).join(" "))}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  "group relative block w-full cursor-zoom-in overflow-hidden",
                  EDITORIAL_PATTERN[i % EDITORIAL_PATTERN.length].split(" ").filter((c) => c.startsWith("aspect")).join(" "),
                )}
                aria-label={`Ampliar: ${p.alt}`}
              >
                <Picture
                  photo={p}
                  fill
                  sizes={i % EDITORIAL_PATTERN.length === 0 ? "100vw" : "(min-width: 768px) 50vw, 100vw"}
                  priority={i < 2}
                  imgClassName="transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.03]"
                />
                {badge(p)}
              </button>
              {p.caption && <p className="mt-2 text-xs text-mist">{p.caption}</p>}
            </li>
          ))}
        </ul>
      )}

      {open !== null && (
        <Lightbox photos={photos} index={open} onClose={() => setIndex(null)} onIndex={(i) => setIndex(i)} actions={actions} />
      )}
    </div>
  );
}
