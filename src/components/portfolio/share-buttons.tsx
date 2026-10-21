"use client";

import { useState } from "react";
import { Link2, MessageCircle, Share2 } from "lucide-react";

export function ShareButtons({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => `${window.location.origin}${path}`;
  const btn =
    "inline-flex h-10 items-center gap-2 border border-line px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-paper-2/80 transition-colors hover:border-paper hover:text-paper";
  return (
    <div className="flex flex-wrap gap-2" aria-label="Compartilhar galeria">
      <button
        type="button"
        className={btn}
        onClick={async () => {
          if (navigator.share) {
            try {
              await navigator.share({ title, url: url() });
            } catch {
              /* cancelado */
            }
          } else {
            await navigator.clipboard.writeText(url());
            setCopied(true);
          }
        }}
      >
        <Share2 className="size-4" aria-hidden /> Compartilhar
      </button>
      <button
        type="button"
        className={btn}
        onClick={async () => {
          await navigator.clipboard.writeText(url());
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        <Link2 className="size-4" aria-hidden /> {copied ? "Link copiado" : "Copiar link"}
      </button>
      <a
        className={btn}
        target="_blank"
        rel="noopener noreferrer"
        href={`https://wa.me/?text=${encodeURIComponent(title + " ")}`}
        onClick={(e) => {
          e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${title} ${url()}`)}`;
        }}
      >
        <MessageCircle className="size-4" aria-hidden /> WhatsApp
      </a>
    </div>
  );
}
