import { expect, test } from "@playwright/test";
import { sql } from "./helpers";

async function fillQuote(page: import("@playwright/test").Page) {
  await page.goto("/orcamento?servico=fotografia-esportiva&origem=e2e");
  // etapa 1: validação bloqueia avanço com campos vazios
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.locator("#name-erro")).toBeVisible();
  await page.fill("#name", "Joana E2E Souza");
  await page.fill("#email", "joana@e2e.test");
  await page.fill("#whatsapp", "21998765432");
  await expect(page.locator("#whatsapp")).toHaveValue("(21) 99876-5432");
  await page.fill("#city", "Niterói");
  await page.selectOption("#state", "RJ");
  await page.locator("label:has(input[name=contactPreference])", { hasText: "WhatsApp" }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  // etapa 2: serviço pré-selecionado pelo link
  await expect(page.getByRole("checkbox", { name: /Fotografia esportiva/ })).toBeChecked();
  await page.getByRole("button", { name: /Continuar/ }).click();
  // etapa 3
  await page.fill("#location", "Campo de São Bento");
  await page.fill("#description", "Cobertura de uma corrida infantil com aproximadamente 150 participantes.");
  await page.getByRole("button", { name: /Continuar/ }).click();
  // etapa 4
  await page.locator("label:has(input[name=budgetRange])", { hasText: "Ainda não defini" }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  // revisão
  await expect(page.getByText("Joana E2E Souza")).toBeVisible();
  await expect(page.getByText("Campo de São Bento")).toBeVisible();
}

test("envio de orçamento: grava no banco e só então confirma", async ({ page }) => {
  await fillQuote(page);
  await page.waitForTimeout(4200); // tempo mínimo anti-spam
  // sem consentimento não envia
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.locator("#consent-erro")).toBeVisible();
  await page.getByLabel(/Li e concordo com o tratamento/).check();
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByRole("heading", { name: /Solicitação recebida/ })).toBeVisible();
  const code = await page.locator("strong.font-mono").textContent();
  expect(code).toMatch(/^ORC-\d{4}-/);
  await expect(page.getByRole("link", { name: /Continuar pelo WhatsApp/ })).toHaveAttribute("href", /wa\.me\/5521965947941/);

  const db = sql();
  const rows = await db`select status, email, source from quote_requests where code = ${code!}`;
  await db.end();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: "novo", email: "joana@e2e.test", source: "e2e" });
});

test("falha no servidor: não mostra sucesso, mantém os dados e permite tentar novamente", async ({ page }) => {
  await fillQuote(page);
  await page.waitForTimeout(4200);
  await page.getByLabel(/Li e concordo com o tratamento/).check();
  let calls = 0;
  await page.route("**/api/quotes", async (route) => {
    calls++;
    if (calls === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Falha simulada no banco." }) });
    return route.continue();
  });
  await page.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(page.getByText("A solicitação não foi enviada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Solicitação recebida/ })).toHaveCount(0);
  await expect(page.getByText("Joana E2E Souza")).toBeVisible();
  await page.getByRole("button", { name: /Tentar novamente/ }).click();
  await expect(page.getByRole("heading", { name: /Solicitação recebida/ })).toBeVisible();
  expect(calls).toBe(2);
});

test("envio automatizado (honeypot/rápido demais/sem origem) é recusado pela API", async ({ request }) => {
  const r1 = await request.post("/api/quotes", { multipart: { name: "Bot" } });
  expect(r1.status()).toBe(403); // sem Origin
  const r2 = await request.post("/api/quotes", { headers: { Origin: "http://localhost:3100" }, multipart: { website: "http://spam", name: "Bot" } });
  expect(r2.status()).toBe(422);
  const r3 = await request.post("/api/quotes", { headers: { Origin: "http://localhost:3100" }, multipart: { name: "Bot", formToken: "123.abc" } });
  expect(r3.status()).toBe(422);
});
