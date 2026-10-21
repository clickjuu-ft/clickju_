import { desc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { PageHeader, Empty, SubmitButton } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Mensagens" };

async function markRead(fd: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  await db.update(schema.contactMessages).set({ readAt: new Date() }).where(eq(schema.contactMessages.id, id));
  await audit(admin.id, "mensagem.lida", "contact", id);
  revalidatePath("/admin/mensagens");
}

async function remove(fd: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(fd.get("id"));
  await db.delete(schema.contactMessages).where(eq(schema.contactMessages.id, id));
  await audit(admin.id, "mensagem.excluida", "contact", id);
  revalidatePath("/admin/mensagens");
}

export default async function MessagesPage() {
  await requireAdmin();
  const list = await db.query.contactMessages.findMany({ orderBy: [desc(schema.contactMessages.createdAt)], limit: 200 });
  const unread = await db.$count(schema.contactMessages, isNull(schema.contactMessages.readAt));
  return (
    <>
      <PageHeader title="Mensagens" description={`Formulário da página Contato · ${unread} não lida(s).`} />
      {list.length === 0 ? (
        <Empty>Nenhuma mensagem recebida.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((m) => (
            <li key={m.id} className={`border bg-ink p-5 ${m.readAt ? "border-line" : "border-violet"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-xs text-mist">
                    <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a>
                    {m.phone ? ` · ${m.phone}` : ""} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!m.readAt && (
                    <form action={markRead}><input type="hidden" name="id" value={m.id} /><SubmitButton variant="ghost">Marcar como lida</SubmitButton></form>
                  )}
                  <form action={remove}><input type="hidden" name="id" value={m.id} /><SubmitButton variant="danger">Excluir</SubmitButton></form>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
