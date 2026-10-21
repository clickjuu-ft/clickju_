"use client";

import { useState } from "react";
import type { PhotoView } from "@/lib/photos";
import { cn } from "@/lib/utils";

/** Imagem do hero com direção de arte: foto vertical opcional no celular. */
export function HeroPicture({ desktop, mobile }: { desktop: PhotoView; mobile: PhotoView | null }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: desktop.color ?? "#15131C", backgroundImage: desktop.blur ? `url(${desktop.blur})` : undefined, backgroundSize: "cover" }}
    >
      <picture className="block h-full w-full">
        {mobile && <source media="(max-width: 767px)" type="image/avif" srcSet={mobile.avifSrcSet} sizes="100vw" />}
        {mobile && <source media="(max-width: 767px)" type="image/webp" srcSet={mobile.webpSrcSet} sizes="100vw" />}
        <source type="image/avif" srcSet={desktop.avifSrcSet} sizes="100vw" />
        <source type="image/webp" srcSet={desktop.webpSrcSet} sizes="100vw" />
        <img
          src={desktop.srcMedium}
          alt={desktop.alt}
          fetchPriority="high"
          decoding="async"
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full scale-[1.03] object-cover transition-[opacity,transform] duration-[1.6s] ease-[cubic-bezier(.16,1,.3,1)]",
            loaded && "scale-100 opacity-100",
            !loaded && "opacity-0",
          )}
        />
      </picture>
    </div>
  );
}
