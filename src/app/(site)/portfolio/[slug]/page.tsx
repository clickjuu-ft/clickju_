import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { and, asc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewProject } from "@/lib/access";
import { getProjectBySlug, projectPhotos, toCards } from "@/lib/portfolio";
import { projectAccessMode, toView } from "@/lib/photos";
import { env } from "@/lib/env";
import { Gallery } from "@/components/portfolio/gallery";
import { UnlockForm } from "@/components/portfolio/unlock-form";
import { ShareButtons } from "@/components/portfolio/share-buttons";
import { ProjectCard } from "@/components/portfolio/project-card";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export async function generateMetadata(props: PageProps<"/portfolio/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const row = await getProjectBySlug(slug);
  if (!row) return { title: "Projeto não encontrado" };
  const { project } = row;
  const isPublic = project.visibility === "public" && project.published;
  if (!isPublic) return { title: project.title, robots: { index: false, follow: false } };
  const cover = project.coverPhotoId ? await db.query.photos.findFirst({ where: eq(schema.photos.id, project.coverPhotoId) }) : null;
  const coverView = cover ? await toView(cover, "public") : null;
  const ogUrl = coverView ? new URL(coverView.srcMedium, env.appUrl).toString() : undefined;
  return {
    title: project.title,
    description: project.summary ?? undefined,
    alternates: { canonical: `/portfolio/${project.slug}` },
    openGraph: {
      title: project.title,
      description: project.summary ?? undefined,
      images: ogUrl ? [{ url: ogUrl, width: 960, alt: coverView?.alt }] : undefined,
    },
  };
}

export default async function ProjectPage(props: PageProps<"/portfolio/[slug]">) {
  const { slug } = await props.params;
  const row = await getProjectBySlug(slug);
  if (!row) notFound();
  const { project, category } = row;
  const user = await getCurrentUser();
  const decision = await canViewProject(project, user);

  if (!decision.allowed) {
    if (decision.reason === "unpublished") notFound();
    return (
      <div className="mx-auto flex min-h-[80svh] max-w-xl flex-col items-center justify-center px-5 pt-24 text-center">
        <Lock className="size-8 text-lilac" aria-hidden />
        <h1 className="display mt-6 text-5xl md:text-6xl">{project.title}</h1>
        {decision.reason === "password" ? (
          <>
            <p className="mt-4 text-mist">Esta galeria é protegida. Informe a senha recebida para visualizar.</p>
            <UnlockForm projectId={project.id} />
          </>
        ) : (
          <>
            <p className="mt-4 text-mist">
              Esta galeria é privada. {decision.reason === "login" ? "Entre com a conta que recebeu acesso." : "Sua conta não tem acesso a ela."}
            </p>
            {decision.reason === "login" && (
              <ButtonLink href={`/login?next=/portfolio/${project.slug}`} className="mt-8">
                Entrar
              </ButtonLink>
            )}
          </>
        )}
      </div>
    );
  }

  const access = projectAccessMode(project);
  const photos = await projectPhotos(project.id, access);
  const related =
    project.visibility === "public"
      ? await toCards(
          await db
            .select({
              project: schema.projects,
              category: { slug: schema.categories.slug, name: schema.categories.name },
              photoCount: schema.projects.sort,
            })
            .from(schema.projects)
            .leftJoin(schema.categories, eq(schema.categories.id, schema.projects.categoryId))
            .where(
              and(
                eq(schema.projects.published, true),
                eq(schema.projects.visibility, "public"),
                ne(schema.projects.id, project.id),
              ),
            )
            .orderBy(asc(schema.projects.sort))
            .limit(3),
          "public",
        )
      : [];

  const quoteHref = `/orcamento?origem=projeto-${project.slug}${category ? `&servico=${category.slug}` : ""}`;
  const meta = [
    ["Categoria", category?.name],
    ["Evento", project.eventName],
    ["Data", project.eventDate ? formatDate(project.eventDate, { month: "long", year: "numeric" }) : null],
    ["Local", project.location],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article className="mx-auto max-w-[1600px] px-5 pb-28 pt-28 md:px-10 md:pt-36">
      <Link href="/portfolio" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Portfólio
      </Link>
      <header className="mt-8 grid gap-10 border-b border-line pb-12 md:grid-cols-12">
        <div className="md:col-span-8">
          {project.isDemo && <p className="eyebrow mb-4">Projeto demonstrativo</p>}
          <h1 className="display text-[clamp(3.2rem,9vw,9rem)]">{project.title}</h1>
          {project.summary && <p className="serif-accent mt-6 max-w-2xl text-2xl text-paper-2/85 md:text-3xl">{project.summary}</p>}
        </div>
        <div className="flex flex-col justify-end gap-8 md:col-span-4">
          {meta.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[0.65rem] uppercase tracking-[0.2em] text-mist">{k}</dt>
                  <dd className="mt-1">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <ShareButtons title={project.title} path={`/portfolio/${project.slug}`} />
        </div>
      </header>

      {project.description && (
        <div className="mx-auto max-w-2xl py-12 text-lg leading-relaxed text-paper-2/80">
          {project.description.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="mb-4">
              {p}
            </p>
          ))}
        </div>
      )}

      <section aria-label="Galeria" className="mt-8">
        <Gallery photos={photos} />
      </section>

      <aside className="mt-24 flex flex-col items-start justify-between gap-8 border-y border-line py-12 md:flex-row md:items-center">
        <div>
          <p className="eyebrow">Gostou deste trabalho?</p>
          <p className="display mt-3 text-4xl md:text-5xl">
            Vamos criar o <span className="serif-accent text-lilac">seu</span>
          </p>
        </div>
        <ButtonLink href={quoteHref} variant="violet" size="lg" arrow>
          Solicitar orçamento
        </ButtonLink>
      </aside>

      {related.length > 0 && (
        <section className="mt-24" aria-labelledby="relacionados">
          <h2 id="relacionados" className="eyebrow mb-10">
            Outros projetos
          </h2>
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p, i) => (
              <li key={p.id}>
                <ProjectCard project={p} aspect="aspect-[4/3]" index={i} sizes="(min-width: 1024px) 33vw, 50vw" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
