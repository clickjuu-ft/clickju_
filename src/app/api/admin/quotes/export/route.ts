import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/auth/session";
import { listQuotes, parseQuoteFilters, serviceNameMap } from "@/lib/quotes/admin";
import { statusLabel } from "@/lib/quotes/schema";
import { audit } from "@/lib/audit";

/** Exporta pedidos filtrados em CSV (somente administradores; sem IP/user-agent). */
export async function GET(req: Request) {
  const admin = await adminOrNull();
  if (!admin) return new NextResponse("Não autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const filters = parseQuoteFilters(sp);
  const [rows, names] = await Promise.all([listQuotes(filters, 10_000), serviceNameMap()]);
  const header = [
    "codigo", "recebido_em", "status", "nome", "email", "whatsapp", "cidade", "uf", "contato_preferido", "servicos",
    "data_evento", "data_alternativa", "local", "duracao", "participantes", "investimento", "qtd_fotos", "prazo",
    "adicionais", "valor_proposta", "validade", "resultado", "arquivado",
  ];
  // proteção contra injeção de fórmulas em planilhas
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((q) =>
    [
      q.code, q.createdAt.toISOString(), statusLabel(q.status), q.name, q.email, q.whatsapp, q.city, q.state, q.contactPreference,
      q.services.map((s) => names[s] ?? s).join("; "), q.eventDate, q.altDate, q.location, q.duration, q.participants,
      q.budgetRange, q.photoCount, q.deadline, q.addons.join("; "), q.proposalValue, q.validUntil, q.outcome, q.archived ? "sim" : "não",
    ].map(cell).join(","),
  );
  await audit(admin.id, "orcamento.exportar_csv", "quote", null, { linhas: rows.length, filtros: filters });
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orcamentos-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
