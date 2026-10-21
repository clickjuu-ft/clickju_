"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen, Bot, Mail, FileText, FolderOpen, Gauge, Inbox, LayoutList, Menu, MessageSquareQuote, ScrollText, Settings, Tags, Users, X, Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: "Comercial",
    items: [
      { href: "/admin", label: "Visão geral", icon: Gauge, exact: true },
      { href: "/admin/orcamentos", label: "Orçamentos", icon: Inbox },
      { href: "/admin/propostas", label: "Propostas", icon: FileText },
      { href: "/admin/mensagens", label: "Mensagens", icon: Mail },
      { href: "/admin/clientes", label: "Clientes e acessos", icon: Users },
    ],
  },
  {
    label: "Portfólio",
    items: [
      { href: "/admin/projetos", label: "Projetos e galerias", icon: FolderOpen },
      { href: "/admin/categorias", label: "Categorias", icon: Tags },
      { href: "/admin/servicos", label: "Serviços", icon: LayoutList },
      { href: "/admin/ia", label: "Inteligência artificial", icon: Bot },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/admin/depoimentos", label: "Depoimentos", icon: MessageSquareQuote },
      { href: "/admin/blog", label: "Blog", icon: Newspaper },
      { href: "/admin/conhecimento", label: "Base do assistente", icon: BookOpen },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
      { href: "/admin/logs", label: "Registro de atividades", icon: ScrollText },
    ],
  },
];

export function AdminNav({ newQuotes }: { newQuotes: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label="Painel" className="space-y-7">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-mist">{g.label}</p>
          <ul>
            {g.items.map((it) => {
              const active = "exact" in it && it.exact ? pathname === it.href : pathname.startsWith(it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                      active ? "bg-paper text-ink" : "text-paper-2/80 hover:bg-ink-2",
                    )}
                  >
                    <it.icon className="size-4" aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    {it.href === "/admin/orcamentos" && newQuotes > 0 && (
                      <span className="rounded-full bg-violet px-2 text-[0.65rem] font-bold text-white">{newQuotes}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <button
        type="button"
        className="fixed right-4 top-3 z-50 grid size-10 place-items-center border border-line bg-ink lg:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      <div className="hidden lg:block">{nav}</div>
      {open && <div className="fixed inset-0 top-16 z-40 overflow-y-auto bg-ink p-5 lg:hidden">{nav}</div>}
    </>
  );
}
