import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { renderProposalPdf } from "@/lib/proposals/pdf";

export async function nextProposalNumber() {
  const year = new Date().getFullYear();
  const n = await db.$count(schema.proposals);
  for (let i = n + 1; i < n + 50; i++) {
    const num = `PROP-${year}-${String(i).padStart(4, "0")}`;
    const exists = await db.query.proposals.findFirst({ where: eq(schema.proposals.number, num), columns: { id: true } });
    if (!exists) return num;
  }
  return `PROP-${year}-${Date.now()}`;
}

export async function proposalPdf(proposalId: string, acceptToken?: string | null) {
  const p = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!p) return null;
  const q = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, p.quoteId) });
  if (!q) return null;
  const s = await getSettings();
  const services = await db.query.services.findMany({ where: inArray(schema.services.slug, q.services) });
  const wa = s.whatsapp.replace(/\D/g, "");
  const pdf = await renderProposalPdf({
    brandName: s.brandName,
    brandEmail: s.email,
    brandWhatsapp: wa.length >= 12 ? `(${wa.slice(2, 4)}) ${wa.slice(4, 9)}-${wa.slice(9)}` : wa,
    brandCity: s.baseCity,
    number: p.number,
    title: p.title,
    createdAt: p.createdAt,
    client: { name: q.name, email: q.email, whatsapp: q.whatsapp, city: `${q.city}/${q.state}` },
    services: services.map((x) => x.name).join(", "),
    eventDate: q.eventDate,
    location: q.location,
    scope: p.scope,
    hours: p.hours,
    deliverables: p.deliverables,
    deliveryDeadline: p.deliveryDeadline,
    items: p.items,
    total: Number(p.total),
    paymentTerms: p.paymentTerms,
    validUntil: p.validUntil,
    conditions: p.conditions,
    acceptUrl: acceptToken ? `${env.appUrl}/proposta/${acceptToken}` : null,
    accepted: p.acceptedAt && p.acceptedName ? { name: p.acceptedName, at: p.acceptedAt } : null,
  });
  return { pdf, number: p.number };
}
