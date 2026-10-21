"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Picture } from "@/components/ui/picture";
import type { PhotoView } from "@/lib/photos";
import { cn } from "@/lib/utils";

type Item = { slug: string; name: string; description: string | null; count: number; cover: PhotoView | null };

/** Índice editorial de categorias com prévia da fotografia ao passar o cursor/foco. */
export function CategoryIndex({ items }: { items: Item[] }) {
  const [active, setActive] = useState(0);
  const current = items[active];
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <ul className="lg:col-span-7" onMouseLeave={() => undefined}>
        {items.map((c, i) => (
          <li key={c.slug} className="border-t border-line last:border-b">
            <Link
              href={`/portfolio?categoria=${c.slug}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group flex items-center justify-between gap-4 py-5 md:py-7"
            >
              <span className="flex items-baseline gap-4 md:gap-6">
                <span className="w-6 text-xs tabular-nums text-mist">{String(i + 1).padStart(2, "0")}</span>
                <span
                  className={cn(
                    "display text-3xl transition-[color,transform] duration-500 sm:text-4xl md:text-6xl",
                    active === i ? "translate-x-2 text-paper" : "text-paper-2/55",
                  )}
                >
                  {c.name}
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs text-mist">
                <span className="hidden sm:inline">{c.count} {c.count === 1 ? "projeto" : "projetos"}</span>
                <ArrowUpRight
                  aria-hidden
                  className={cn("size-5 transition-all duration-500", active === i ? "text-lilac" : "opacity-30")}
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="relative hidden lg:col-span-5 lg:block">
        <div className="sticky top-28 aspect-[4/5] overflow-hidden bg-ink-2">
          {items.map((c, i) =>
            c.cover ? (
              <div
                key={c.slug}
                aria-hidden={i !== active}
                className={cn(
                  "absolute inset-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)]",
                  i === active ? "scale-100 opacity-100" : "scale-[1.06] opacity-0",
                )}
              >
                <Picture photo={c.cover} fill sizes="40vw" />
              </div>
            ) : null,
          )}
          {current && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-sm text-white/90">
              {current.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
