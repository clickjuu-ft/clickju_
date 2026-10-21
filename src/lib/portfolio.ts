import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { toView, type PhotoView, type Project } from "@/lib/photos";

export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: { slug: string; name: string } | null;
  eventName: string | null;
  eventDate: string | null;
  location: string | null;
  isDemo: boolean;
  photoCount: number;
  cover: PhotoView | null;
};

export async function getCategories() {
  return db.query.categories.findMany({ orderBy: [asc(schema.categories.sort), asc(schema.categories.name)] });
}

/** Projetos públicos e publicados, com filtros opcionais. */
export async function listPublicProjects(filters: {
  category?: string;
  q?: string;
  year?: string;
  event?: string;
  featured?: boolean;
  limit?: number;
} = {}): Promise<ProjectCard[]> {
  const where: SQL[] = [eq(schema.projects.published, true), eq(schema.projects.visibility, "public")];
  if (filters.featured) where.push(eq(schema.projects.featured, true));
  if (filters.category) {
    const cat = await db.query.categories.findFirst({ where: eq(schema.categories.slug, filters.category) });
    where.push(cat ? eq(schema.projects.categoryId, cat.id) : sql`false`);
  }
  if (filters.year && /^\d{4}$/.test(filters.year)) {
    where.push(sql`extract(year from ${schema.projects.eventDate}) = ${Number(filters.year)}`);
  }
  if (filters.event) where.push(ilike(schema.projects.eventName, `%${filters.event}%`));
  if (filters.q) {
    const q = `%${filters.q.trim()}%`;
    // busca no projeto e nas legendas/etiquetas das fotografias
    where.push(
      or(
        ilike(schema.projects.title, q),
        ilike(schema.projects.summary, q),
        ilike(schema.projects.description, q),
        ilike(schema.projects.eventName, q),
        ilike(schema.projects.location, q),
        sql`exists (select 1 from photos p where p.project_id = ${schema.projects.id} and (
              p.search_text ilike ${q}
              or to_tsvector('portuguese'::regconfig, p.search_text) @@ plainto_tsquery('portuguese', ${filters.q.trim()})))`,
      )!,
    );
  }
  const rows = await db
    .select({
      project: schema.projects,
      category: { slug: schema.categories.slug, name: schema.categories.name },
      photoCount: sql<number>`(select count(*)::int from photos p where p.project_id = ${schema.projects.id})`,
    })
    .from(schema.projects)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.projects.categoryId))
    .where(and(...where))
    .orderBy(asc(schema.projects.sort), desc(schema.projects.eventDate))
    .limit(filters.limit ?? 100);
  return toCards(rows, "public");
}

export async function toCards(
  rows: { project: Project; category: { slug: string; name: string } | null; photoCount: number }[],
  access: "public" | "private",
): Promise<ProjectCard[]> {
  const coverIds = rows.map((r) => r.project.coverPhotoId).filter(Boolean) as string[];
  const covers = coverIds.length ? await db.query.photos.findMany({ where: inArray(schema.photos.id, coverIds) }) : [];
  const coverViews = new Map(await Promise.all(covers.map(async (c) => [c.id, await toView(c, access)] as const)));
  return rows.map(({ project, category, photoCount }) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    category: category?.slug ? category : null,
    eventName: project.eventName,
    eventDate: project.eventDate,
    location: project.location,
    isDemo: project.isDemo,
    photoCount: Number(photoCount),
    cover: project.coverPhotoId ? (coverViews.get(project.coverPhotoId) ?? null) : null,
  }));
}

export async function getProjectBySlug(slug: string) {
  const rows = await db
    .select({ project: schema.projects, category: schema.categories })
    .from(schema.projects)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.projects.categoryId))
    .where(eq(schema.projects.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function projectPhotos(projectId: string, access: "public" | "private") {
  const rows = await db.query.photos.findMany({
    where: eq(schema.photos.projectId, projectId),
    orderBy: [asc(schema.photos.sort), asc(schema.photos.createdAt)],
  });
  return Promise.all(rows.map((p) => toView(p, access)));
}

/** Fotos recentes de projetos públicos, alternando entre projetos (seção "Trabalhos recentes"). */
export async function recentPublicPhotos(limit = 8) {
  const rows = await db
    .select({ photo: schema.photos, slug: schema.projects.slug, title: schema.projects.title })
    .from(schema.photos)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.photos.projectId))
    .where(and(eq(schema.projects.published, true), eq(schema.projects.visibility, "public")))
    .orderBy(desc(schema.photos.createdAt))
    .limit(limit * 8);
  // intercala: 1ª foto de cada projeto, depois a 2ª de cada… (variedade visual)
  const byProject = new Map<string, typeof rows>();
  for (const r of rows) byProject.set(r.slug, [...(byProject.get(r.slug) ?? []), r]);
  const picked: typeof rows = [];
  for (let round = 0; picked.length < limit && round < 8; round++) {
    for (const list of byProject.values()) {
      if (list[round] && picked.length < limit) picked.push(list[round]);
    }
  }
  return Promise.all(picked.map(async (r) => ({ view: await toView(r.photo, "public"), slug: r.slug, title: r.title })));
}

export async function photoViewById(id: string | null, access: "public" | "private" = "public") {
  if (!id) return null;
  const p = await db.query.photos.findFirst({ where: eq(schema.photos.id, id) });
  return p ? toView(p, access) : null;
}

export async function publicYears(): Promise<number[]> {
  const rows = await db.execute<{ y: number }>(sql`
    select distinct extract(year from event_date)::int as y from projects
    where published and visibility = 'public' and event_date is not null order by y desc`);
  return rows.map((r) => Number(r.y));
}
