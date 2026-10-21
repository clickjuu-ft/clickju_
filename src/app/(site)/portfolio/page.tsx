import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getCategories, listPublicProjects, publicYears } from "@/lib/portfolio";
import { ProjectCard } from "@/components/portfolio/project-card";
import { Reveal } from "@/components/site/reveal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portfólio",
  description: "Projetos de fotografia esportiva, corridas, eventos, retratos, editorial e trabalhos autorais.",
  alternates: { canonical: "/portfolio" },
};

const ASPECTS = ["aspect-[4/5]", "aspect-[3/4]", "aspect-[4/5]", "aspect-square", "aspect-[3/4]", "aspect-[4/5]"];

export default async function PortfolioPage(props: PageProps<"/portfolio">) {
  const sp = await props.searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 120) : undefined);
  const filters = { category: str(sp.categoria), q: str(sp.q), year: str(sp.ano), event: str(sp.evento) };
  const [categories, projects, years] = await Promise.all([getCategories(), listPublicProjects(filters), publicYears()]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { categoria: filters.category, q: filters.q, ano: filters.year, evento: filters.event, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/portfolio?${s}` : "/portfolio";
  };
  const activeCat = categories.find((c) => c.slug === filters.category);

  return (
    <div className="mx-auto max-w-[1600px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <Reveal>
        <p className="eyebrow">Portfólio</p>
        <h1 className="display mt-4 text-[clamp(3.5rem,10vw,10rem)]">
          {activeCat ? activeCat.name : "Trabalhos"}
          {!activeCat && <span className="serif-accent text-lilac"> selecionados</span>}
        </h1>
        {activeCat?.description && <p className="mt-6 max-w-xl text-lg text-paper-2/75">{activeCat.description}</p>}
      </Reveal>

      {/* filtros */}
      <div className="sticky top-16 z-30 -mx-5 mt-12 border-y border-line bg-ink/90 px-5 py-4 backdrop-blur md:top-20 md:-mx-10 md:px-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Categorias" className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto">
            <Link
              href={qs({ categoria: undefined })}
              aria-current={!filters.category ? "page" : undefined}
              className={cn(
                "shrink-0 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] transition-colors",
                !filters.category ? "bg-paper text-ink" : "text-mist hover:text-paper",
              )}
            >
              Todos
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={qs({ categoria: c.slug })}
                aria-current={filters.category === c.slug ? "page" : undefined}
                className={cn(
                  "shrink-0 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] transition-colors",
                  filters.category === c.slug ? "bg-paper text-ink" : "text-mist hover:text-paper",
                )}
              >
                {c.name}
              </Link>
            ))}
          </nav>
          <form action="/portfolio" role="search" className="flex flex-wrap items-end gap-3">
            {filters.category && <input type="hidden" name="categoria" value={filters.category} />}
            <label className="relative min-w-48 flex-1">
              <span className="sr-only">Buscar por palavra-chave</span>
              <Search className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden />
              <input name="q" defaultValue={filters.q} placeholder="Buscar: modalidade, cena, local…" className="field py-2 pl-6 text-sm" />
            </label>
            <label>
              <span className="sr-only">Evento</span>
              <input name="evento" defaultValue={filters.event} placeholder="Evento" className="field w-32 py-2 text-sm" />
            </label>
            <label>
              <span className="sr-only">Ano</span>
              <select name="ano" defaultValue={filters.year ?? ""} className="field w-24 py-2 text-sm">
                <option value="">Ano</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-9 bg-paper px-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-lilac">Filtrar</button>
          </form>
        </div>
      </div>

      {(filters.q || filters.year || filters.event) && (
        <p className="mt-8 text-sm text-mist">
          {projects.length} {projects.length === 1 ? "resultado" : "resultados"}
          {filters.q && <> para “{filters.q}”</>} ·{" "}
          <Link href={qs({ q: undefined, ano: undefined, evento: undefined })} className="text-lilac underline underline-offset-4">
            limpar filtros
          </Link>
        </p>
      )}

      {projects.length === 0 ? (
        <div className="py-32 text-center">
          <p className="display text-4xl text-paper-2/50">Nada por aqui ainda</p>
          <p className="mt-4 text-mist">Tente outra categoria ou palavra-chave.</p>
        </div>
      ) : (
        <ul className="mt-14 grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => (
            <Reveal as="li" key={p.id} delay={(i % 3) * 0.06} className={cn(i % 3 === 1 && "lg:mt-20")}>
              <ProjectCard project={p} index={i} aspect={ASPECTS[i % ASPECTS.length]} priority={i < 3} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
