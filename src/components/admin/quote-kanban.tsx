"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setQuoteStatus } from "@/server/admin/quote-actions";
import { QUOTE_STATUSES } from "@/lib/quotes/schema";
import { cn } from "@/lib/utils";

type Card = { id: string; code: string; name: string; services: string; createdAt: string; eventDate: string | null; status: string; budget: string };

/** Kanban do fluxo comercial: arrastar entre colunas ou usar o seletor (acessível por teclado). */
export function QuoteKanban({ cards }: { cards: Card[] }) {
  const [pending, start] = useTransition();
  const [optimistic, move] = useOptimistic(cards, (state, { id, status }: { id: string; status: string }) =>
    state.map((c) => (c.id === id ? { ...c, status } : c)),
  );
  const change = (id: string, status: string) =>
    start(async () => {
      move({ id, status });
      await setQuoteStatus(id, status);
    });

  return (
    <div className={cn("scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8", pending && "cursor-progress")}>
      {QUOTE_STATUSES.map((col) => {
        const list = optimistic.filter((c) => c.status === col.value);
        return (
          <section
            key={col.value}
            aria-label={col.label}
            className="flex w-72 shrink-0 flex-col border border-line bg-ink"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/quote-id");
              if (id) change(id, col.value);
            }}
          >
            <header className="flex items-center justify-between border-b border-line px-3 py-2">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]">{col.label}</h2>
              <span className="text-xs tabular-nums text-mist">{list.length}</span>
            </header>
            <ul className="flex min-h-32 flex-1 flex-col gap-2 p-2">
              {list.map((c) => (
                <li
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/quote-id", c.id)}
                  className="cursor-grab border border-line bg-ink-2/50 p-3 text-sm active:cursor-grabbing"
                >
                  <Link href={`/admin/orcamentos/${c.id}`} className="font-semibold hover:text-lilac">
                    {c.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-[0.65rem] text-mist">{c.code}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-paper-2/80">{c.services}</p>
                  <p className="mt-1 text-xs text-mist">
                    {c.eventDate ? `Data: ${c.eventDate}` : "Sem data"} · {c.budget}
                  </p>
                  <label className="mt-2 block">
                    <span className="sr-only">Mover {c.name} para</span>
                    <select className="input py-1 text-xs" value={c.status} onChange={(e) => change(c.id, e.target.value)}>
                      {QUOTE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
