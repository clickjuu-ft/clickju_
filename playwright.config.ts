import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o build de produção. Antes: `npm run build`.
 * Usa um banco e armazenamento próprios (recriados a cada execução).
 */
const PORT = 3100;
const E2E_ENV = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://foto:foto@localhost:5432/foto_e2e",
  APP_URL: `http://localhost:${PORT}`,
  APP_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef",
  STORAGE_DRIVER: "local",
  STORAGE_LOCAL_DIR: "./.e2e-storage",
  ANTHROPIC_API_KEY: "",
  RESEND_API_KEY: "",
  SMTP_URL: "",
  TURNSTILE_SECRET_KEY: "",
};
Object.assign(process.env, E2E_ENV);

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_BROWSERS_PATH === "/opt/pw-browsers" ? { executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, testMatch: /quote|public/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/robots.txt`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: E2E_ENV,
  },
});
