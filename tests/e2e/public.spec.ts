import { expect, test } from "@playwright/test";
import { fx } from "./helpers";

test("página inicial e navegação principal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.getByRole("link", { name: /Solicitar orçamento/ }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("portfólio: filtro, busca e visualização em tela cheia com teclado", async ({ page, isMobile }) => {
  const { pub } = fx();
  await page.goto("/portfolio?q=Projeto%20P%C3%BAblico");
  await expect(page.getByRole("link", { name: /Projeto Público/ })).toBeVisible();
  await expect(page.getByText(/Galeria Privada/)).toHaveCount(0); // privado nunca aparece
  await page.goto(`/portfolio/${pub}`);
  await page.locator("ul button[aria-label^='Ampliar']").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-label", /Fotografia 1 de 2/);
  if (!isMobile) {
    await page.keyboard.press("ArrowRight");
    await expect(dialog).toHaveAttribute("aria-label", /Fotografia 2 de 2/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});
