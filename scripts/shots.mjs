// Utilitário de desenvolvimento: capturas sequenciais (viewport) de uma página rolada.
import { chromium } from "@playwright/test";
const [url, prefix, w = "1440", h = "900", count = "6"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.goto(url, { waitUntil: "networkidle" });
const total = await page.evaluate(() => document.body.scrollHeight);
const n = Math.min(Number(count), Math.ceil(total / Number(h)));
for (let i = 0; i < n; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * Number(h));
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${prefix}-${i}.png` });
}
console.log("total height", total, "shots", n);
await browser.close();
