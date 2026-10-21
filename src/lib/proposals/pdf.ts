import "server-only";
import PDFDocument from "pdfkit";
import type { ProposalItem } from "@/lib/db/schema";
import { formatBRL, formatDate } from "@/lib/utils";

export type ProposalPdfData = {
  brandName: string;
  brandEmail: string;
  brandWhatsapp: string;
  brandCity: string;
  number: string;
  title: string;
  createdAt: Date;
  client: { name: string; email: string; whatsapp: string; city: string };
  services: string;
  eventDate: string | null;
  location: string | null;
  scope: string;
  hours: string | null;
  deliverables: string;
  deliveryDeadline: string;
  items: ProposalItem[];
  total: number;
  paymentTerms: string;
  validUntil: string;
  conditions: string | null;
  acceptUrl: string | null;
  accepted: { name: string; at: Date } | null;
};

const BLACK = "#09090D";
const VIOLET = "#8B5CF6";
const MIST = "#6B6779";
const LINE = "#E4E0EC";

/** Gera o PDF da proposta (A4, fundo branco, identidade preto/roxo). */
export async function renderProposalPdf(input: ProposalPdfData): Promise<Buffer> {
  // normaliza quebras de linha do Windows (\r aparece como glifo nas fontes padrão)
  const clean = (v: string | null) => (v === null ? null : v.replace(/\r\n?/g, "\n"));
  const d: ProposalPdfData = {
    ...input,
    scope: clean(input.scope)!,
    deliverables: clean(input.deliverables)!,
    paymentTerms: clean(input.paymentTerms)!,
    conditions: clean(input.conditions),
  };
  const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: 56, bottom: 64, left: 56, right: 56 }, info: { Title: `Proposta ${d.number}`, Author: d.brandName } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const W = doc.page.width - 112;
  const L = 56;

  // marca (CLI / CKJU®)
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(20).text("CLI", L, 52, { lineGap: -6, characterSpacing: -0.6 });
  doc.text("CKJU", L, doc.y - 2, { continued: true, characterSpacing: -0.6 }).fontSize(6).text(" ®");
  doc.font("Helvetica").fontSize(8.5).fillColor(MIST);
  doc.text([d.brandEmail, d.brandWhatsapp, d.brandCity].filter(Boolean).join("   ·   "), L, 60, { width: W, align: "right" });
  doc.text(`Proposta ${d.number}  ·  emitida em ${formatDate(d.createdAt)}`, L, 74, { width: W, align: "right" });

  doc.moveTo(L, 112).lineTo(L + W, 112).lineWidth(2).strokeColor(VIOLET).stroke();

  doc.fillColor(VIOLET).font("Helvetica-Bold").fontSize(8).text("PROPOSTA COMERCIAL", L, 130, { characterSpacing: 2 });
  doc.fillColor(BLACK).font("Helvetica-Bold").fontSize(22).text(d.title, L, 146, { width: W });
  doc.moveDown(0.8);

  const section = (label: string) => {
    if (doc.y > doc.page.height - 150) doc.addPage();
    doc.moveDown(0.6);
    doc.fillColor(VIOLET).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), L, doc.y, { characterSpacing: 1.6 });
    doc.moveTo(L, doc.y + 3).lineTo(L + W, doc.y + 3).lineWidth(0.6).strokeColor(LINE).stroke();
    doc.moveDown(0.6);
    doc.fillColor(BLACK).font("Helvetica").fontSize(10);
  };
  const row = (k: string, v: string | null | undefined) => {
    if (!v) return;
    const y = doc.y;
    doc.fillColor(MIST).font("Helvetica").fontSize(8.5).text(k, L, y, { width: 130 });
    doc.fillColor(BLACK).fontSize(10).text(v, L + 140, y, { width: W - 140 });
    doc.moveDown(0.35);
  };

  section("Cliente");
  row("Nome", d.client.name);
  row("Contato", `${d.client.email}  ·  ${d.client.whatsapp}`);
  row("Cidade", d.client.city);

  section("Serviço");
  row("Serviço", d.services);
  row("Data", d.eventDate ? formatDate(d.eventDate, { dateStyle: "full" }) : "A definir");
  row("Local", d.location);
  row("Horas previstas", d.hours);

  section("Escopo da cobertura");
  doc.text(d.scope, L, doc.y, { width: W, lineGap: 2 });

  section("Entregáveis");
  doc.text(d.deliverables, L, doc.y, { width: W, lineGap: 2 });
  doc.moveDown(0.4);
  row("Prazo de entrega", d.deliveryDeadline);

  section("Investimento");
  if (d.items.length) {
    for (const it of d.items) {
      const y = doc.y;
      doc.fillColor(BLACK).font("Helvetica").fontSize(10).text(it.description, L, y, { width: W - 120 });
      const h = doc.y;
      doc.text(formatBRL(it.amount), L + W - 110, y, { width: 110, align: "right" });
      doc.y = Math.max(h, doc.y);
      doc.moveTo(L, doc.y + 4).lineTo(L + W, doc.y + 4).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.moveDown(0.6);
    }
  }
  const ty = doc.y + 4;
  doc.rect(L, ty, W, 34).fill(BLACK);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text("VALOR TOTAL", L + 14, ty + 12, { characterSpacing: 1.5 });
  doc.fontSize(15).text(formatBRL(d.total), L, ty + 9, { width: W - 14, align: "right" });
  doc.y = ty + 46;
  doc.fillColor(BLACK).font("Helvetica").fontSize(10);
  row("Pagamento", d.paymentTerms);
  row("Validade", `Proposta válida até ${formatDate(d.validUntil, { dateStyle: "long" })}`);

  if (d.conditions) {
    section("Condições adicionais");
    doc.fontSize(9.5).text(d.conditions, L, doc.y, { width: W, lineGap: 2 });
  }

  section("Aceite");
  if (d.accepted) {
    doc.fontSize(10).text(`Proposta aceita eletronicamente por ${d.accepted.name} em ${formatDate(d.accepted.at, { dateStyle: "long", timeStyle: "short" })}.`, L, doc.y, { width: W });
  } else {
    doc.fontSize(9.5).fillColor(MIST).text(
      "A disponibilidade da data é confirmada somente após o aceite desta proposta e a confirmação da fotógrafa." +
        (d.acceptUrl ? ` Para aceitar online, acesse: ${d.acceptUrl}` : ""),
      L,
      doc.y,
      { width: W, lineGap: 2 },
    );
    doc.moveDown(2.5);
    doc.moveTo(L, doc.y).lineTo(L + 220, doc.y).lineWidth(0.6).strokeColor(BLACK).stroke();
    doc.fillColor(MIST).fontSize(8).text("Assinatura do cliente / data", L, doc.y + 4);
  }

  // rodapé em todas as páginas
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // evita criar página nova ao escrever o rodapé
    doc.fillColor(MIST).fontSize(7.5).text(`${d.brandName}  ·  Proposta ${d.number}  ·  página ${i + 1} de ${range.count}`, L, doc.page.height - 40, {
      width: W,
      align: "center",
      lineBreak: false,
    });
  }
  doc.end();
  return done;
}
