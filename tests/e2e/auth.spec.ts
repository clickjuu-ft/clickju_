import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("áreas administrativas exigem login e são noindex", async ({ page, request }) => {
  await page.goto("/admin/orcamentos");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Forcamentos/);
  const api = await request.get("/api/admin/quotes/export");
  expect(api.status()).toBe(401);
  const res = await request.get("/admin", { maxRedirects: 0 });
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
});

test("cliente não acessa o painel administrativo", async ({ page }) => {
  await login(page, "cliente@e2e.test");
  await expect(page).toHaveURL(/\/cliente/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cliente/);
  const r = await page.request.get("/api/admin/quotes/export");
  expect(r.status()).toBe(401);
});

test("admin vê pedidos, usa kanban e exporta CSV", async ({ page }) => {
  await login(page, "admin@e2e.test");
  await expect(page).toHaveURL(/\/admin/);
  await page.goto("/admin/orcamentos?view=kanban");
  await expect(page.getByRole("region", { name: "Novo pedido" })).toBeVisible();
  const csv = await page.request.get("/api/admin/quotes/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
});

test("senha errada não entra e não revela se o e-mail existe", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@e2e.test");
  await page.fill("#password", "errada-123456");
  await page.click("button[type=submit]");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await page.fill("#email", "naoexiste@e2e.test");
  await page.click("button[type=submit]");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
