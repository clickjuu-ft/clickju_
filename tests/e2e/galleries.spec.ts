import { expect, test } from "@playwright/test";
import { fx, login } from "./helpers";

test("galeria privada: anônimo e cliente sem acesso são bloqueados", async ({ page }) => {
  const { priv } = fx();
  await page.goto(`/portfolio/${priv.slug}`);
  await expect(page.getByText("Esta galeria é privada.")).toBeVisible();
  await expect(page.locator("picture img")).toHaveCount(0);

  await login(page, "intruso@e2e.test");
  await page.goto(`/portfolio/${priv.slug}`);
  await expect(page.getByText("Sua conta não tem acesso a ela.")).toBeVisible();
  const r = await page.goto(`/cliente/projetos/${priv.id}`);
  expect(r?.status()).toBe(404);
  await page.goto("/cliente");
  await expect(page.getByText("Nenhuma galeria liberada ainda")).toBeVisible();
});

test("cliente autorizado vê a galeria, favorita e baixa o original", async ({ page }) => {
  const { priv } = fx();
  await login(page, "cliente@e2e.test");
  await page.goto("/cliente");
  await page.getByRole("link", { name: /Galeria Privada/ }).first().click();
  await expect(page.getByRole("heading", { name: "Galeria Privada" })).toBeVisible();
  await page.locator("ul button[aria-label^='Ampliar']").first().click();
  await page.getByRole("button", { name: "Marcar como favorita" }).click();
  await expect(page.getByRole("button", { name: "Remover das favoritas" })).toBeVisible();
  const href = await page.getByRole("link", { name: "Baixar arquivo" }).getAttribute("href");
  const dl = await page.request.get(href!);
  expect(dl.status()).toBe(200);
  expect(dl.headers()["content-disposition"]).toContain("attachment");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: /Favoritas \(1\)/ })).toBeVisible();
  expect(priv.id).toBeTruthy();
});

test("galeria com senha: senha errada falha, certa libera", async ({ page }) => {
  const { pwd } = fx();
  await page.goto(`/portfolio/${pwd}`);
  await page.fill("#gallery-password", "errada");
  await page.getByRole("button", { name: "Acessar galeria" }).click();
  await expect(page.getByText("Senha incorreta.")).toBeVisible();
  await page.fill("#gallery-password", "segredo123");
  await page.getByRole("button", { name: "Acessar galeria" }).click();
  await expect(page.locator("ul picture img").first()).toBeVisible();
});

test("URLs de arquivos privados expiram/adulteradas são recusadas", async ({ page, request }) => {
  const { pwd } = fx();
  await page.goto(`/portfolio/${pwd}`);
  await page.fill("#gallery-password", "segredo123");
  await page.getByRole("button", { name: "Acessar galeria" }).click();
  const src = await page.locator("ul picture img").first().getAttribute("src");
  expect(src).toMatch(/\/api\/media\/v\/.+&s=/);
  expect((await request.get(src!)).status()).toBe(200);
  const tampered = src!.replace(/s=[^&]+/, "s=adulterada");
  expect((await request.get(tampered)).status()).toBe(403);
  const original = src!.replace(/\/api\/media\/v\/([^/]+)\/.+?\?/, "/api/media/originals/$1.jpg?");
  expect((await request.get(original)).status()).toBe(403);
});
