"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { importBucketRoot, pendingBucketImports } from "@/lib/import-bucket";
import type { FormState } from "@/server/auth-actions";

/** Importa poucas fotos por clique para caber na memória e no tempo de uma requisição. */
export async function importFromBucket(_p: FormState): Promise<FormState> {
  const admin = await requireAdmin();
  const r = await importBucketRoot(3);
  const left = (await pendingBucketImports()).length;
  await audit(admin.id, "foto.importar_bucket", "project", r.projectId, { importadas: r.imported, falhas: r.failed.length });
  revalidatePath("/admin/projetos");
  if (r.failed.length && !r.imported) return { error: `Falha ao importar: ${r.failed[0]}` };
  return {
    ok: true,
    message: `${r.imported} foto(s) importada(s) para “Fotos importadas”.${left ? ` Faltam ${left} — clique de novo para continuar.` : " Tudo importado!"}${r.failed.length ? ` ${r.failed.length} falharam.` : ""}`,
  };
}
