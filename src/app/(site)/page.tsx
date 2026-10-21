import { MessageCircle } from "lucide-react";
import { HeroPicture } from "@/components/site/hero-picture";
import { FloatingCollage } from "@/components/site/floating-collage";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSettings, whatsappLink } from "@/lib/settings";
import { getCategories, listPublicProjects, photoViewById, recentPublicPhotos } from "@/lib/portfolio";
import { Picture } from "@/components/ui/picture";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/site/reveal";
import { SectionHeading } from "@/components/site/section-heading";
import { ProjectCard } from "@/components/portfolio/project-card";
import { CategoryIndex } from "@/components/site/category-index";

export default async function HomePage() {
  const settings = await getSettings();
  const [hero, heroMobile, about, featured, categories, recent, testimonials] = await Promise.all([
    photoViewById(settings.heroPhotoId),
    photoViewById(settings.heroMobilePhotoId),
    photoViewById(settings.aboutPhotoId),
    listPublicProjects({ featured: true, limit: 5 }),
    getCategories(),
    recentPublicPhotos(10),
    db.query.testimonials.findMany({
      where: eq(schema.testimonials.published, true),
      orderBy: [asc(schema.testimonials.sort)],
    }),
  ]);

  // capa e contagem por categoria (somente projetos públicos)
  const allPublic = await listPublicProjects({ limit: 200 });
  const counts = await db
    .select({ categoryId: schema.projects.categoryId, n: sql<number>`count(*)::int` })
    .from(schema.projects)
    .where(sql`${schema.projects.published} and ${schema.projects.visibility} = 'public'`)
    .groupBy(schema.projects.categoryId);
  const categoryItems = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    count: Number(counts.find((x) => x.categoryId === c.id)?.n ?? 0),
    cover: allPublic.find((p) => p.category?.slug === c.slug)?.cover ?? null,
  }));

  const wa = whatsappLink(settings.whatsapp, "Olá! Vim pelo site e gostaria de um orçamento.");
  const [lead, ...rest] = featured;

  return (
    <>
      {/* HERO ------------------------------------------------------- */}
      <section className="theme-dark relative isolate flex min-h-[100svh] items-center overflow-hidden bg-ink" aria-label="Apresentação">
        {hero ? (
          <HeroPicture desktop={hero} mobile={heroMobile} />
        ) : (
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_30%,#2a1b4d,transparent_60%)]" />
        )}
        {/* escurecimento: mais forte à esquerda (texto) e embaixo; a fotografia segue protagonista */}
        <div className="absolute inset-0 -z-10 bg-ink/45 md:bg-transparent md:bg-gradient-to-r md:from-ink/85 md:via-ink/45 md:to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-gradient-to-t from-ink to-transparent" />

        <div className="mx-auto w-full max-w-[1600px] px-5 pb-24 pt-32 md:px-10">
          <div className="max-w-3xl">
            <p className="eyebrow animate-fade-in">{settings.heroEyebrow}</p>
            <h1 className="mt-5 text-[clamp(2.9rem,6.6vw,6.25rem)] font-extrabold leading-[0.95] tracking-[-0.02em] [font-stretch:88%]">
              <span className="block animate-fade-in [animation-delay:80ms]">{settings.heroTitle}</span>
              <span className="block text-lilac animate-fade-in [animation-delay:200ms]">{settings.heroAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-paper-2/85 animate-fade-in [animation-delay:320ms] md:text-xl">{settings.heroText}</p>
            <div className="mt-10 flex flex-col gap-3 animate-fade-in [animation-delay:440ms] sm:flex-row">
              <ButtonLink href="/orcamento?origem=home" variant="violet" size="lg" arrow>
                Solicitar orçamento
              </ButtonLink>
              <ButtonLink href="/portfolio" variant="outline" size="lg">
                Explorar portfólio
              </ButtonLink>
            </div>
          </div>
        </div>

        <a
          href="#destaques"
          aria-label="Rolar para os projetos em destaque"
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:block"
        >
          <span className="flex h-11 w-7 justify-center rounded-full border-2 border-paper-2/60 pt-2 transition-colors hover:border-lilac">
            <span className="h-2 w-1 rounded-full bg-lilac motion-safe:animate-bounce" />
          </span>
        </a>
      </section>

      {/* DESTAQUES -------------------------------------------------- */}
      {lead && (
        <section id="destaques" className="mx-auto max-w-[1600px] px-5 py-24 md:px-10 md:py-36">
          <Reveal>
            <SectionHeading index="01" eyebrow="Projetos em destaque" title="Histórias" accent="em quadros">
              <ButtonLink href="/portfolio" variant="ghost" arrow className="px-0">
                Ver todo o portfólio
              </ButtonLink>
            </SectionHeading>
          </Reveal>
          <div className="mt-16 grid gap-x-8 gap-y-16 md:grid-cols-12">
            <Reveal className="md:col-span-7">
              <ProjectCard project={lead} index={0} aspect="aspect-[4/5] md:aspect-[5/6]" sizes="(min-width: 768px) 58vw, 100vw" />
            </Reveal>
            <div className="flex flex-col gap-16 md:col-span-5 md:pt-40">
              {rest.slice(0, 1).map((p, i) => (
                <Reveal key={p.id} delay={0.1}>
                  <ProjectCard project={p} index={i + 1} aspect="aspect-[4/3]" sizes="(min-width: 768px) 40vw, 100vw" />
                </Reveal>
              ))}
            </div>
            {rest.slice(1, 4).map((p, i) => (
              <Reveal
                key={p.id}
                delay={i * 0.08}
                className={i === 0 ? "md:col-span-4 md:col-start-2" : i === 1 ? "md:col-span-3 md:mt-24" : "md:col-span-4"}
              >
                <ProjectCard project={p} index={i + 2} aspect={i === 1 ? "aspect-[3/4]" : "aspect-[4/5]"} sizes="(min-width: 768px) 33vw, 100vw" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* CATEGORIAS ------------------------------------------------- */}
      <section className="border-t border-line bg-ink-2/40">
        <div className="mx-auto max-w-[1600px] px-5 py-24 md:px-10 md:py-32">
          <Reveal>
            <SectionHeading index="02" eyebrow="Áreas de atuação" title="O que" accent="eu fotografo" className="mb-14" />
          </Reveal>
          <CategoryIndex items={categoryItems} />
        </div>
      </section>

      {/* SOBRE ------------------------------------------------------ */}
      <section className="mx-auto grid max-w-[1600px] gap-12 px-5 py-24 md:grid-cols-12 md:px-10 md:py-36">
        <Reveal className="md:col-span-5">
          {about ? (
            <Picture photo={about} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/5]" />
          ) : (
            <div className="aspect-[4/5] bg-ink-2" />
          )}
        </Reveal>
        <Reveal className="flex flex-col justify-center md:col-span-6 md:col-start-7" delay={0.1}>
          <p className="eyebrow flex items-center gap-3">
            <span className="text-mist">03</span>
            <span className="h-px w-8 bg-lilac/60" aria-hidden />
            Apresentação
          </p>
          <h2 className="display mt-4 text-5xl md:text-7xl">
            {settings.aboutTitle}
          </h2>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-paper-2/80">
            {settings.aboutText
              .split(/\n{2,}/)
              .slice(0, 2)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
          <div className="mt-10">
            <ButtonLink href="/sobre" variant="outline" arrow>
              Conheça meu trabalho
            </ButtonLink>
          </div>
        </Reveal>
      </section>

      {/* RECENTES --------------------------------------------------- */}
      {recent.length > 0 && (
        <section className="border-t border-line py-24 md:py-32" aria-labelledby="recentes">
          <div className="mx-auto max-w-[1600px] px-5 md:px-10">
            <Reveal>
              <SectionHeading index="04" eyebrow="Trabalhos recentes" title="Últimos" accent="registros" />
            </Reveal>
          </div>
          <h2 id="recentes" className="sr-only">
            Trabalhos recentes
          </h2>
          <div className="mt-10 md:mt-4">
            <FloatingCollage items={recent} />
          </div>
        </section>
      )}

      {/* DEPOIMENTOS — exibidos somente quando cadastrados ----------- */}
      {testimonials.length > 0 && (
        <section className="border-t border-line bg-ink-2/40" aria-labelledby="depoimentos">
          <div className="mx-auto max-w-[1600px] px-5 py-24 md:px-10 md:py-32">
            <Reveal>
              <SectionHeading index="05" eyebrow="Depoimentos" title="Quem" accent="viveu a experiência" />
            </Reveal>
            <h2 id="depoimentos" className="sr-only">
              Depoimentos
            </h2>
            <div className="mt-14 grid gap-px bg-line md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <Reveal key={t.id} delay={i * 0.06} className="bg-ink p-8 md:p-10">
                  <figure>
                    <blockquote className="serif-accent text-2xl leading-snug text-paper md:text-3xl">“{t.quote}”</blockquote>
                    <figcaption className="mt-6 text-sm">
                      <span className="font-semibold uppercase tracking-[0.14em]">{t.author}</span>
                      {t.context && <span className="block text-mist">{t.context}</span>}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-violet/15 blur-[140px]" aria-hidden />
        <div className="relative mx-auto max-w-[1600px] px-5 py-28 md:px-10 md:py-40">
          <Reveal>
            <p className="eyebrow">Vamos conversar</p>
            <h2 className="display mt-6 max-w-[16ch] text-[clamp(3rem,8vw,8rem)]">
              {settings.ctaTitle}
            </h2>
            <p className="mt-8 max-w-xl text-lg text-paper-2/75">{settings.ctaText}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/orcamento?origem=home-cta" variant="violet" size="lg" arrow>
                Solicitar orçamento
              </ButtonLink>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-14 items-center justify-center gap-2 border border-line-strong px-8 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:border-paper hover:bg-paper hover:text-ink"
                >
                  <MessageCircle className="size-4" aria-hidden /> Conversar no WhatsApp
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
