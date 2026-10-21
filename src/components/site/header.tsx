"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

const NAV = [
  { href: "/portfolio", label: "Portfólio" },
  { href: "/servicos", label: "Serviços" },
  { href: "/sobre", label: "Sobre" },
  { href: "/blog", label: "Blog" },
  { href: "/contato", label: "Contato" },
];

export function Header({
  brandName,
  logos,
  account,
}: {
  brandName: string;
  logos?: { onDark: string | null; onLight: string | null };
  account: { href: string; label: string } | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const overHero = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || !overHero || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500",
        solid ? "border-b border-line bg-ink/90 backdrop-blur-md" : "theme-dark border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 md:h-20 md:px-10">
        <Link href="/" className="group flex items-center gap-2" aria-label={`${brandName} — página inicial`}>
          {(solid ? logos?.onLight : logos?.onDark) ? (
            <span className="block h-10 md:h-12">
              <Logo src={(solid ? logos?.onLight : logos?.onDark) ?? null} label={brandName} />
            </span>
          ) : (
            <Logo className="text-[1.05rem] text-paper transition-colors group-hover:text-lilac md:text-[1.3rem]" label={brandName} />
          )}
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition-colors",
                  active ? "text-paper" : "text-paper-2/70 hover:text-paper",
                  "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-lilac after:transition-transform after:duration-500",
                  active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          <Link
            href={account?.href ?? "/login"}
            className="hidden items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-paper-2/70 transition-colors hover:text-paper md:flex"
          >
            <UserRound className="size-4" aria-hidden />
            {account?.label ?? "Entrar"}
          </Link>
          <Link href="/orcamento" className={buttonClass("violet", "sm", "max-sm:!hidden")}>
            Solicitar orçamento
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <div
        id="menu-mobile"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 overflow-y-auto bg-ink px-5 pb-10 pt-6 lg:hidden"
      >
        <nav aria-label="Menu móvel" className="flex flex-col">
          {[{ href: "/", label: "Início" }, ...NAV].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className="display flex items-baseline justify-between border-b border-line py-4 text-5xl animate-fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {item.label}
              <span className="text-xs font-normal tracking-widest text-mist">0{i + 1}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-8 flex flex-col gap-3">
          <Link href="/orcamento" className={buttonClass("primary", "lg")}>
            Solicitar orçamento
          </Link>
          <Link href={account?.href ?? "/login"} className={buttonClass("outline", "lg")}>
            {account?.label ?? "Entrar / Área do cliente"}
          </Link>
        </div>
      </div>
    </header>
  );
}
