import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { photoViewById } from "@/lib/portfolio";
import { SimpleMarkdown } from "@/lib/markdown";
import { Picture } from "@/components/ui/picture";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

async function getPost(slug: string) {
  return db.query.blogPosts.findFirst({ where: and(eq(schema.blogPosts.slug, slug), eq(schema.blogPosts.published, true)) });
}

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const p = await getPost((await props.params).slug);
  return p ? { title: p.title, description: p.excerpt ?? undefined, alternates: { canonical: `/blog/${p.slug}` }, openGraph: { type: "article" } } : { title: "Post não encontrado" };
}

export default async function PostPage(props: PageProps<"/blog/[slug]">) {
  const post = await getPost((await props.params).slug);
  if (!post) notFound();
  const cover = await photoViewById(post.coverPhotoId);
  return (
    <article className="mx-auto max-w-3xl px-5 pb-28 pt-32 md:pt-40">
      <Link href="/blog" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Blog
      </Link>
      <p className="mt-8 text-xs uppercase tracking-[0.16em] text-mist">{formatDate(post.publishedAt, { dateStyle: "long" })}</p>
      <h1 className="display mt-3 text-5xl md:text-7xl">{post.title}</h1>
      {post.excerpt && <p className="serif-accent mt-6 text-2xl text-paper-2/85">{post.excerpt}</p>}
      {cover && <Picture photo={cover} priority sizes="(min-width: 768px) 768px, 100vw" className="mt-10" />}
      <div className="mt-10 text-lg">
        <SimpleMarkdown text={post.body} />
      </div>
      <div className="mt-16 border-t border-line pt-10">
        <ButtonLink href="/orcamento?origem=blog" variant="violet" arrow>Solicitar orçamento</ButtonLink>
      </div>
    </article>
  );
}
