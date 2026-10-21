import { readFileSync } from "node:fs";
import postgres from "postgres";
import type { Page } from "@playwright/test";

export const fx = () =>
  JSON.parse(readFileSync("tests/e2e/.fixtures.json", "utf8")) as {
    pub: string;
    priv: { id: string; slug: string };
    pwd: string;
    password: string;
  };

export function sql() {
  return postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", fx().password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}
