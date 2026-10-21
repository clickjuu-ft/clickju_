import { describe, expect, it } from "vitest";
import { clientStep, projectStep, quoteSchema, fieldErrors } from "@/lib/quotes/schema";
import { validQuote } from "./helpers";

describe("validação do orçamento", () => {
  it("aceita um pedido válido e normaliza e-mail e WhatsApp", () => {
    const r = quoteSchema.parse(validQuote());
    expect(r.email).toBe("maria@example.com");
    expect(r.whatsapp).toBe("21987654321");
    expect(r.participants).toBe(300);
  });

  it("aceita WhatsApp com DDI 55 e fixo com DDD", () => {
    expect(clientStep.shape.whatsapp.parse("+55 21 98765-4321")).toBe("21987654321");
    expect(clientStep.shape.whatsapp.parse("(21) 2345-6789")).toBe("2123456789");
  });

  it("rejeita WhatsApp sem DDD, e-mail inválido e nome sem sobrenome", () => {
    const r = quoteSchema.safeParse(validQuote({ whatsapp: "98765-4321", email: "x@", name: "Maria" }));
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.whatsapp).toMatch(/DDD/);
    expect(errs.email).toBeTruthy();
    expect(errs.name).toMatch(/sobrenome/);
  });

  it("rejeita data no passado e data alternativa igual à principal", () => {
    expect(projectStep.safeParse({ ...validQuote(), eventDate: "2020-01-01" }).success).toBe(false);
    const d = validQuote().eventDate;
    const r = projectStep.safeParse({ ...validQuote(), altDate: d });
    expect(r.success).toBe(false);
  });

  it("exige consentimento e ao menos um serviço", () => {
    const r = quoteSchema.safeParse(validQuote({ consent: false, services: [] }));
    expect(r.success).toBe(false);
    const errs = fieldErrors(r.error!);
    expect(errs.consent).toBeTruthy();
    expect(errs.services).toBeTruthy();
  });

  it("descrição curta demais é rejeitada", () => {
    expect(quoteSchema.safeParse(validQuote({ description: "curto" })).success).toBe(false);
  });
});
