"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Heart, Check, Download } from "lucide-react";
import type { PhotoView } from "@/lib/photos";
import { cn } from "@/lib/utils";

export type LightboxActions = {
  isFavorite?: (id: string) => boolean;
  onToggleFavorite?: (id: string) => void;
  approval?: (id: string) => "approved" | "rejected" | undefined;
  onApprove?: (id: string, status: "approved" | "rejected") => void;
  downloadHref?: (id: string) => string | null;
};

/**
 * Visualização em tela cheia: setas do teclado, Esc, +/−, gestos de arrastar (swipe),
 * duplo clique/toque para zoom até a resolução real da maior variante e arraste para mover.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
  actions,
}: {
  photos: PhotoView[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  actions?: LightboxActions;
}) {
  const photo = photos[index];
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; t: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  // zoom máximo = resolução real da maior variante / largura exibida
  const maxZoom = useCallback(() => {
    const el = imgRef.current;
    if (!el || !el.clientWidth) return 2;
    const largest = Math.max(...photo.webpSrcSet.split(", ").map((s) => Number(s.split(" ")[1]?.replace("w", "")) || 0));
    return Math.max(1.5, Math.min(4, largest / el.clientWidth));
  }, [photo]);

  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = (index + dir + photos.length) % photos.length;
      setLoaded(false);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      onIndex(next);
    },
    [index, photos.length, onIndex],
  );

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      prevFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(maxZoom(), z * 1.5));
      else if (e.key === "-") setZoom((z) => (z / 1.5 <= 1.01 ? (setOffset({ x: 0, y: 0 }), 1) : z / 1.5));
      else if (e.key === "Tab") {
        // mantém o foco dentro do diálogo
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, maxZoom]);

  // pré-carrega vizinhas
  useEffect(() => {
    for (const d of [1, -1]) {
      const p = photos[(index + d + photos.length) % photos.length];
      if (p) {
        const img = new Image();
        img.src = p.srcMedium;
      }
    }
  }, [index, photos]);

  const toggleZoom = (clientX?: number, clientY?: number) => {
    if (zoom > 1) return resetZoom();
    const z = maxZoom();
    const el = imgRef.current;
    if (el && clientX !== undefined && clientY !== undefined) {
      const r = el.getBoundingClientRect();
      const dx = clientX - (r.left + r.width / 2);
      const dy = clientY - (r.top + r.height / 2);
      setOffset({ x: -dx * (z - 1), y: -dy * (z - 1) });
    }
    setZoom(z);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, t: Date.now(), moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (zoom > 1) setOffset({ x: d.ox + dx, y: d.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (zoom === 1 && d.moved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && Date.now() - d.t < 800) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (zoom === 1 && d.moved && dy > 120 && Math.abs(dy) > Math.abs(dx)) {
      onClose(); // arrastar para baixo fecha
      return;
    }
    if (!d.moved) {
      const now = Date.now();
      if (now - lastTap.current < 300) toggleZoom(e.clientX, e.clientY);
      lastTap.current = now;
    }
  };

  if (!photo) return null;
  const fav = actions?.isFavorite?.(photo.id);
  const approval = actions?.approval?.(photo.id);
  const dl = actions?.downloadHref?.(photo.id);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Fotografia ${index + 1} de ${photos.length}`}
      tabIndex={-1}
      className="theme-dark fixed inset-0 z-[90] flex flex-col bg-ink/[0.97] outline-none animate-fade-in"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3 text-sm md:h-16 md:px-6">
        <span className="tabular-nums text-mist" aria-live="polite">
          {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-1">
          {actions?.onToggleFavorite && (
            <button
              type="button"
              onClick={() => actions.onToggleFavorite!(photo.id)}
              aria-pressed={!!fav}
              className={cn("grid size-11 place-items-center hover:text-lilac", fav && "text-lilac")}
              aria-label={fav ? "Remover das favoritas" : "Marcar como favorita"}
            >
              <Heart className={cn("size-5", fav && "fill-current")} />
            </button>
          )}
          {actions?.onApprove && (
            <button
              type="button"
              onClick={() => actions.onApprove!(photo.id, approval === "approved" ? "rejected" : "approved")}
              aria-pressed={approval === "approved"}
              className={cn(
                "flex h-11 items-center gap-2 px-3 text-xs uppercase tracking-widest hover:text-lilac",
                approval === "approved" && "text-ok",
              )}
            >
              <Check className="size-4" /> {approval === "approved" ? "Aprovada" : "Aprovar"}
            </button>
          )}
          {dl && (
            <a href={dl} className="grid size-11 place-items-center hover:text-lilac" aria-label="Baixar arquivo">
              <Download className="size-5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => (zoom > 1 ? resetZoom() : toggleZoom())}
            className="grid size-11 place-items-center hover:text-lilac"
            aria-label={zoom > 1 ? "Reduzir zoom" : "Ampliar"}
          >
            {zoom > 1 ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center hover:text-lilac" aria-label="Fechar (Esc)">
            <X className="size-6" />
          </button>
        </div>
      </div>

      <div
        className={cn("relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onWheel={(e) => {
          if (e.ctrlKey || zoom > 1) {
            setZoom((z) => {
              const nz = Math.min(maxZoom(), Math.max(1, z * (e.deltaY < 0 ? 1.15 : 0.87)));
              if (nz === 1) setOffset({ x: 0, y: 0 });
              return nz;
            });
          }
        }}
      >
        {!loaded && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.blur ?? undefined} alt="" aria-hidden className="absolute max-h-full max-w-full scale-105 blur-xl" style={{ aspectRatio: `${photo.width}/${photo.height}`, height: "100%" }} />
        )}
        <picture key={photo.id}>
          <source type="image/avif" srcSet={photo.avifSrcSet} sizes={zoom > 1 ? "300vw" : "100vw"} />
          <source type="image/webp" srcSet={photo.webpSrcSet} sizes={zoom > 1 ? "300vw" : "100vw"} />
          <img
            ref={imgRef}
            src={photo.src}
            alt={photo.alt}
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={cn(
              "max-h-[calc(100svh-8.5rem)] max-w-[calc(100vw-1.5rem)] object-contain transition-[opacity] duration-500 md:max-w-[calc(100vw-10rem)]",
              loaded ? "opacity-100" : "opacity-0",
            )}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: dragging ? "none" : "transform 0.45s cubic-bezier(.16,1,.3,1), opacity 0.5s",
            }}
          />
        </picture>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute left-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center border border-line bg-ink/40 backdrop-blur transition-colors hover:border-paper md:grid"
              aria-label="Fotografia anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              className="absolute right-2 top-1/2 hidden size-12 -translate-y-1/2 place-items-center border border-line bg-ink/40 backdrop-blur transition-colors hover:border-paper md:grid"
              aria-label="Próxima fotografia"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-14 shrink-0 items-center justify-center px-6 py-3 text-center text-sm text-paper-2/80">
        {photo.caption ?? <span className="text-mist">Use ← → ou arraste para navegar · duplo clique para ampliar</span>}
      </div>
    </div>
  );
}
