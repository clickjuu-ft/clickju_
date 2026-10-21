import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { clientAccess } from "@/lib/access";
import { projectPhotos } from "@/lib/portfolio";
import { inviteViewer, submitSelection } from "@/server/client-actions";
import { ClientGallery } from "@/components/client/client-gallery";
import { ActionForm } from "@/components/forms/action-form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Galeria" };

export default async function ClientProject(props: PageProps<"/cliente/projetos/[id]">) {
  const user = await requireUser("/cliente");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const access = user.role === "admin" ? { canDownload: true, canShare: false } : await clientAccess(id, user);
  // sem acesso = 404 (não revela a existência do projeto)
  if (!access) notFound();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, id) });
  if (!project) notFound();
  const photos = await projectPhotos(id, "private");
  const ids = photos.map((p) => p.id);
  const [favs, apprs] = ids.length
    ? await Promise.all([
        db.query.favorites.findMany({ where: and(eq(schema.favorites.userId, user.id), inArray(schema.favorites.photoId, ids)) }),
        db.query.approvals.findMany({ where: and(eq(schema.approvals.userId, user.id), inArray(schema.approvals.photoId, ids)) }),
      ])
    : [[], []];

  return (
    <>
      <Link href="/cliente" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-mist hover:text-paper">
        <ArrowLeft className="size-4" aria-hidden /> Minhas galerias
      </Link>
      <header className="mt-6 grid gap-8 border-b border-line pb-10 md:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="display text-5xl md:text-7xl">{project.title}</h1>
          {project.summary && <p className="mt-4 text-lg text-paper-2/80">{project.summary}</p>}
        </div>
        <div className="space-y-2 text-sm">
          {project.deliveryInfo && <p className="whitespace-pre-line">{project.deliveryInfo}</p>}
          {project.deliveryDate && <p className="text-mist">Entrega prevista: {formatDate(project.deliveryDate)}</p>}
          <p className="text-mist">{access.canDownload ? "Download dos arquivos liberado." : "Somente visualização."}</p>
        </div>
      </header>

      <section className="mt-10" aria-label="Fotografias">
        <ClientGallery
          photos={photos}
          initialFavorites={favs.map((f) => f.photoId)}
          initialApprovals={Object.fromEntries(apprs.map((a) => [a.photoId, a.status as "approved" | "rejected"]))}
          canDownload={!!access.canDownload}
        />
      </section>

      <section className="mt-16 grid gap-10 border-t border-line pt-10 md:grid-cols-2">
        <div>
          <h2 className="eyebrow mb-4">Enviar minha seleção</h2>
          <p className="mb-4 text-sm text-mist">Quando terminar de marcar favoritas e aprovar fotografias, envie para a fotógrafa.</p>
          <ActionForm action={submitSelection} submitLabel="Enviar seleção" variant="violet" className="max-w-md">
            <input type="hidden" name="projectId" value={id} />
            <textarea name="note" rows={3} placeholder="Observações (opcional)" className="field" aria-label="Observações" />
          </ActionForm>
        </div>
        {access.canShare && (
          <div>
            <h2 className="eyebrow mb-4">Compartilhar acesso</h2>
            <p className="mb-4 text-sm text-mist">Convide alguém para visualizar esta galeria (sem permissão de download).</p>
            <ActionForm action={inviteViewer} submitLabel="Convidar" className="max-w-md">
              <input type="hidden" name="projectId" value={id} />
              <input name="email" type="email" placeholder="E-mail da pessoa" className="field" aria-label="E-mail" />
            </ActionForm>
          </div>
        )}
      </section>
    </>
  );
}
