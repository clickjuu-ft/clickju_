/**
 * Política de retenção (LGPD). Execute diariamente (cron/agendador da hospedagem):
 *   npm run retention            → aplica
 *   npm run retention -- --dry   → apenas mostra o que seria feito
 *
 * - Pedidos encerrados (recusado/cancelado ou arquivados) há mais de N meses
 *   (Configurações → retenção) são ANONIMIZADOS e seus anexos apagados.
 * - Sessões e links de redefinição expirados, limites de taxa antigos e
 *   registros de e-mail com mais de 12 meses são removidos.
 * - Registros de auditoria são mantidos por AUDIT_RETENTION_MONTHS (padrão 24).
 */
import "dotenv/config";
import { and, inArray, isNull, lt, or, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getSettings } from "@/lib/settings";

const dry = process.argv.includes("--dry");

async function main() {
  const s = await getSettings();
  const months = s.retentionMonths;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const old = await db.query.quoteRequests.findMany({
    where: and(
      lt(schema.quoteRequests.updatedAt, cutoff),
      isNull(schema.quoteRequests.anonymizedAt),
      or(eq(schema.quoteRequests.archived, true), inArray(schema.quoteRequests.status, ["recusado", "cancelado"])),
    ),
  });
  console.log(`Pedidos a anonimizar (encerrados há mais de ${months} meses): ${old.length}`);
  if (!dry) {
    for (const q of old) {
      for (const a of q.attachments) await storage().delete(a.key).catch(() => {});
      await db
        .update(schema.quoteRequests)
        .set({
          name: "Titular anonimizado", email: `anonimizado+${q.code.toLowerCase()}@invalido.local`, whatsapp: "00000000000", city: "—",
          description: "[removido pela política de retenção]", specificNeeds: null, extraInfo: null, location: null, attachments: [],
          ipHash: null, userAgent: null, anonymizedAt: new Date(),
        })
        .where(eq(schema.quoteRequests.id, q.id));
      await db.update(schema.quoteEvents).set({ body: "[removido]" }).where(and(eq(schema.quoteEvents.quoteId, q.id), sql`${schema.quoteEvents.kind} in ('note','contact')`));
    }
    const contactCutoff = new Date();
    contactCutoff.setMonth(contactCutoff.getMonth() - months);
    await db.delete(schema.contactMessages).where(lt(schema.contactMessages.createdAt, contactCutoff));
    await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
    await db.delete(schema.passwordResets).where(lt(schema.passwordResets.expiresAt, new Date()));
    await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, new Date(Date.now() - 2 * 86400_000)));
    await db.delete(schema.emailLog).where(lt(schema.emailLog.createdAt, new Date(Date.now() - 365 * 86400_000)));
    const auditMonths = Number(process.env.AUDIT_RETENTION_MONTHS ?? 24);
    await db.execute(sql`delete from audit_logs where created_at < now() - make_interval(months => ${auditMonths})`);
  }
  console.log(dry ? "Simulação concluída (nada foi alterado)." : "✓ Retenção aplicada.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
