"use client";

import { useState } from "react";
import type { PhotoView } from "@/lib/photos";
import { cn } from "@/lib/utils";

/**
 * Fotografia responsiva com AVIF/WebP, placeholder desfocado e carregamento progressivo.
 * Nunca aponta para o arquivo original.
 */
export function Picture({
  photo,
  sizes = "100vw",
  priority = false,
  className,
  imgClassName,
  fill = false,
}: {
  photo: PhotoView;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  fill?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn("overflow-hidden", fill ? "absolute inset-0" : "relative", className)}
      style={{
        aspectRatio: fill ? undefined : `${photo.width} / ${photo.height}`,
        backgroundColor: photo.color ?? "#15131C",
        backgroundImage: photo.blur ? `url(${photo.blur})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <picture className="block h-full w-full">
        <source type="image/avif" srcSet={photo.avifSrcSet} sizes={sizes} />
        <source type="image/webp" srcSet={photo.webpSrcSet} sizes={sizes} />
        <img
          src={photo.srcMedium}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-700 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName,
          )}
        />
      </picture>
    </div>
  );
}
