import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Eye, EyeOff, Lock, Link2, Star } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { createProject } from "@/server/admin/portfolio-actions";
import { importFromBucket } from "@/server/admin/import-actions";
import { pendingBucketImports } from "@/lib/import-bucket";
import { ActionForm } from "@/components/forms/action-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { photoViewById } from "@/lib/portfolio";

export const metadata = { title: "Projetos" };

const VIS = { public: "Público", unlisted: "Só com link", password: "Senha", private: "Privado (clientes)" } as const;

export default async function ProjectsAdmin() {
  await requireAdmin();
  const rows = await db
    .select({
      p: schema.projects,
      cat: schema.categories.name,
      n: sql<number>`(select count(*)::int from photos where photos.project_id = ${schema.projects.id})`,
    })
    .from(schema.projects)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.projects.categoryId))
    .orderBy(asc(schema.projects.sort), asc(schema.projects.createdAt));
  const covers = await Promise.all(rows.map((r) => photoViewById(r.p.coverPhotoId, "private")));
  const pending = await pendingBucketImports().catch(() => []);
  return (
    <>
      <PageHeader title="Projetos e galerias" description="Cada projeto é uma galeria independente: pública no portfólio, protegida por senha, acessível por link ou privada para clientes." />
      {pending.length > 0 && (
        <Panel title={`${pending.length} foto(s) enviadas direto ao armazenamento`} className="mb-6 border-violet">
          <p className="mb-3 text-sm text-mist">
            Encontramos fotos soltas no bucket (enviadas fora do site). Importe para processá-las e organizá-las — elas vão para o projeto
            “Fotos importadas”, em rascunho. São processadas 3 por clique.
          </p>
          <ActionForm action={importFromBucket} submitLabel="Importar fotos" pendingLabel="Importando… (pode levar 1–2 min)" variant="violet" className="space-y-0 [&>button]:w-auto">
            {null}
          </ActionForm>
        </Panel>
      )}
      <Panel title="Novo projeto" className="mb-6">
        <ActionForm action={createProject} submitLabel="Criar projeto" className="grid gap-3 space-y-0 md:grid-cols-[1fr_200px] md:items-end">
          <label className="block">
            <span className="label">Título</span>
            <input name="title" required className="input" placeholder="Ex.: Corrida Noturna 2026" />
          </label>
        </ActionForm>
      </Panel>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ p, cat, n }, i) => (
          <li key={p.id} className="border border-line bg-ink">
            <Link href={`/admin/projetos/${p.id}`} className="group block">
              <div className="aspect-[3/2] overflow-hidden bg-ink-2">
                {covers[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={covers[i]!.srcMedium} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold group-hover:text-lilac">{p.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
                  <span>{cat ?? "Sem categoria"}</span>
                  <span>{n} fotos</span>
                  <span className="inline-flex items-center gap-1">
                    {p.visibility === "public" ? <Eye className="size-3" /> : p.visibility === "password" ? <Lock className="size-3" /> : p.visibility === "unlisted" ? <Link2 className="size-3" /> : <EyeOff className="size-3" />}
                    {VIS[p.visibility]}
                  </span>
                  {!p.published && <span className="text-amber-600">Rascunho</span>}
                  {p.featured && <Star className="size-3 fill-current text-violet" aria-label="Destaque" />}
                  {p.isDemo && <span>Demonstração</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
