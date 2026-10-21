import { describe, expect, it } from "vitest";
import { hashPassword, ipHash, signPayload, verifyPassword, verifySignedPayload } from "@/lib/crypto";
import { assertKey, storage } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { GET as mediaGET } from "@/app/api/media/[...key]/route";

describe("senhas", () => {
  it("hash scrypt verifica a senha correta e rejeita a incorreta", async () => {
    const h = await hashPassword("minha-senha-123");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("minha-senha-123", h)).toBe(true);
    expect(await verifyPassword("outra", h)).toBe(false);
  });
  it("IP nunca é guardado em claro", () => {
    expect(ipHash("203.0.113.7")).not.toContain("203");
    expect(ipHash(null)).toBeNull();
  });
});

describe("URLs temporárias", () => {
  it("assinatura válida, adulterada e expirada", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signPayload("k|", exp);
    expect(verifySignedPayload("k|", exp, sig)).toBe(true);
    expect(verifySignedPayload("outra|", exp, sig)).toBe(false);
    expect(verifySignedPayload("k|", exp - 120, signPayload("k|", exp - 120))).toBe(false);
  });

  it("rota de mídia entrega com assinatura e recusa sem ela", async () => {
    await storage().put("originals/teste.txt", Buffer.from("conteudo"), "text/plain");
    const url = await storage().signedUrl("originals/teste.txt", { access: "private" });
    const ctx = (key: string) => ({ params: Promise.resolve({ key: key.split("/") }) }) as never;
    const ok = await mediaGET(new Request(`http://localhost${url}`), ctx("originals/teste.txt"));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toMatch(/^private/);
    const tampered = await mediaGET(new Request(`http://localhost${url.replace("originals/teste.txt", "originals/outro.txt")}`), ctx("originals/outro.txt"));
    expect(tampered.status).toBe(403);
    const noSig = await mediaGET(new Request("http://localhost/api/media/originals/teste.txt"), ctx("originals/teste.txt"));
    expect(noSig.status).toBe(403);
  });

  it("bloqueia path traversal nas chaves", () => {
    expect(() => assertKey("../etc/passwd")).toThrow();
    expect(() => assertKey("v/../../x")).toThrow();
    expect(() => assertKey("/abs")).toThrow();
    expect(() => assertKey("v/abc/1/480.webp")).not.toThrow();
  });
});

describe("limite de requisições", () => {
  it("permite até o limite e bloqueia depois", async () => {
    const key = `teste:${Date.now()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(key, 3, 60));
    expect(results).toEqual([true, true, true, false]);
  });
});
