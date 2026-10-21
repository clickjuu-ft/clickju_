// Utilitário de desenvolvimento: captura de tela de uma página.
// uso: node scripts/shot.mjs <url> <arquivo> [largura] [altura] [fullPage]
import { chromium } from "@playwright/test";
const [url, out, w = "1440", h = "900", full = "false"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: full === "true" });
await browser.close();
