import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";
import {
  checkFormToken, createQuote, generateQuoteCode, issueFormToken, looksLikeSpam, notifyQuote, QuoteError, sniffAttachment,
} from "@/lib/quotes/service";
import { makeJpeg, seedServices, validQuote } from "./helpers";

const meta = { ipHash: "abc", userAgent: "vitest", source: "teste" };

beforeAll(seedServices);

describe("processamento real do orçamento", () => {
  it("salva o pedido com código único, status inicial e histórico", async () => {
    const created = await createQuote(validQuote(), [], meta);
    expect(created.code).toMatch(/^ORC-\d{4}-[2-9A-Z]{6}$/);
    const row = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, created.id) });
    expect(row?.status).toBe("novo");
    expect(row?.email).toBe("maria@example.com");
    expect(row?.consentAt).toBeInstanceOf(Date);
    const events = await db.query.quoteEvents.findMany({ where: eq(schema.quoteEvents.quoteId, created.id) });
    expect(events.length).toBe(1);
  });

  it("valida no servidor contra o catálogo (serviço inativo/inexistente e faixa inválida)", async () => {
    await expect(createQuote(validQuote({ services: ["inativo"] }), [], meta)).rejects.toBeInstanceOf(QuoteError);
    await expect(createQuote(validQuote({ services: ["nao-existe"] }), [], meta)).rejects.toBeInstanceOf(QuoteError);
    await expect(createQuote(validQuote({ budgetRange: "R$ 1 milhão" }), [], meta)).rejects.toThrow(/inválid/);
  });

  it("guarda anexos válidos em armazenamento privado", async () => {
    const jpg = await makeJpeg(400, 300);
    const created = await createQuote(validQuote(), [{ name: "ref.jpg", type: "image/jpeg", bytes: jpg }], meta);
    const row = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, created.id) });
    expect(row?.attachments).toHaveLength(1);
    expect(await storage().get(row!.attachments[0].key)).not.toBeNull();
  });

  it("rejeita anexo que não é imagem/PDF de verdade (extensão falsa)", async () => {
    const fake = Buffer.from("<script>alert(1)</script> isto não é jpeg");
    await expect(createQuote(validQuote(), [{ name: "foto.jpg", type: "image/jpeg", bytes: fake }], meta)).rejects.toThrow(/Tipo de arquivo/);
  });

  it("é atômico: falha no armazenamento não deixa pedido salvo", async () => {
    const before = await db.$count(schema.quoteRequests);
    const spy = vi.spyOn(storage(), "put").mockRejectedValueOnce(new Error("disco cheio"));
    const jpg = await makeJpeg(200, 200);
    await expect(createQuote(validQuote({ name: "Atomico Teste" }), [{ name: "a.jpg", type: "image/jpeg", bytes: jpg }], meta)).rejects.toThrow("disco cheio");
    spy.mockRestore();
    expect(await db.$count(schema.quoteRequests)).toBe(before);
  });

  it("notificação sem e-mail configurado é registrada como não enviada (sem fingir)", async () => {
    const created = await createQuote(validQuote(), [], meta);
    const r = await notifyQuote(created.id);
    expect(r).toEqual({ notified: "skipped", confirmation: "skipped" });
    const row = await db.query.quoteRequests.findFirst({ where: eq(schema.quoteRequests.id, created.id) });
    expect(row?.notifiedAt).toBeNull();
    const logs = await db.query.emailLog.findMany();
    expect(logs.every((l) => l.status === "skipped")).toBe(true);
  });
});

describe("proteção contra spam", () => {
  it("token de formulário exige tempo mínimo e expira", () => {
    const now = Date.now();
    const t = issueFormToken(now);
    expect(checkFormToken(t, now + 1000)).toMatch(/rápido/);
    expect(checkFormToken(t, now + 10_000)).toBeNull();
    expect(checkFormToken(t, now + 2 * 86400_000)).toMatch(/expirou/);
    expect(checkFormToken(t.replace(/.$/, "x"), now + 10_000)).toMatch(/inválido/);
    expect(checkFormToken(null)).toBeTruthy();
  });

  it("detecta excesso de links", () => {
    expect(looksLikeSpam({ description: "http://a http://b http://c http://d", extraInfo: undefined, specificNeeds: undefined })).toBe(true);
    expect(looksLikeSpam({ description: "Meu evento no site www.exemplo.com", extraInfo: undefined, specificNeeds: undefined })).toBe(false);
  });

  it("identifica tipos de arquivo pelo conteúdo", async () => {
    expect(sniffAttachment(await makeJpeg(50, 50))?.mime).toBe("image/jpeg");
    expect(sniffAttachment(Buffer.from("%PDF-1.7\n....."))?.mime).toBe("application/pdf");
    expect(sniffAttachment(Buffer.from("MZ executável....."))).toBeNull();
  });

  it("gera códigos distintos", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateQuoteCode()));
    expect(codes.size).toBe(200);
  });
});
