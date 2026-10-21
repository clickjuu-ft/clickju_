import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { photoViewById } from "@/lib/portfolio";
import { Picture } from "@/components/ui/picture";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Blog", description: "Bastidores, dicas e histórias por trás das fotografias.", alternates: { canonical: "/blog" } };

export default async function BlogPage() {
  const posts = await db.query.blogPosts.findMany({ where: eq(schema.blogPosts.published, true), orderBy: [desc(schema.blogPosts.publishedAt)] });
  const covers = await Promise.all(posts.map((p) => photoViewById(p.coverPhotoId)));
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-28 pt-32 md:px-10 md:pt-40">
      <p className="eyebrow">Blog</p>
      <h1 className="display mt-4 text-[clamp(3.5rem,9vw,8rem)]">Diário <span className="serif-accent text-lilac">de bordo</span></h1>
      {posts.length === 0 ? (
        <p className="mt-16 text-mist">Nenhum post publicado ainda.</p>
      ) : (
        <ul className="mt-16 divide-y divide-line border-y border-line">
          {posts.map((p, i) => (
            <li key={p.id}>
              <Link href={`/blog/${p.slug}`} className="group grid gap-6 py-10 md:grid-cols-[240px_1fr] md:items-center">
                {covers[i] ? <Picture photo={covers[i]!} sizes="240px" className="aspect-[4/3]" /> : <div className="hidden md:block" />}
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-mist">{formatDate(p.publishedAt, { dateStyle: "long" })}</p>
                  <h2 className="mt-2 text-3xl font-bold uppercase [font-stretch:80%] group-hover:text-lilac md:text-4xl">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 text-paper-2/75">{p.excerpt}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
