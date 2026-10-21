import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Somente páginas públicas: projetos privados, por senha ou só-com-link ficam de fora. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const [projects, posts] = await Promise.all([
    db.query.projects.findMany({ where: and(eq(schema.projects.published, true), eq(schema.projects.visibility, "public")), columns: { slug: true, updatedAt: true } }),
    db.query.blogPosts.findMany({ where: eq(schema.blogPosts.published, true), columns: { slug: true, updatedAt: true } }),
  ]);
  const staticPages = ["", "/portfolio", "/servicos", "/sobre", "/orcamento", "/contato", "/blog", "/privacidade", "/termos"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...projects.map((p) => ({ url: `${base}/portfolio/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
