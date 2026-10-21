import "server-only";
import { db, schema } from "@/lib/db";
import { ipHash } from "@/lib/crypto";
import { clientIp } from "@/lib/request";

/** Registra uma operação administrativa. Falhas de log nunca derrubam a operação principal. */
export async function audit(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    let ip: string | null = null;
    try {
      ip = await clientIp();
    } catch {
      // fora de um request (scripts)
    }
    await db.insert(schema.auditLogs).values({
      userId,
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta ?? null,
      ipHash: ipHash(ip),
    });
  } catch (e) {
    console.error("[audit] falha ao registrar", action, e);
  }
}
