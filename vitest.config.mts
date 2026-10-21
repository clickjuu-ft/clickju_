import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/unit/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/unit/global-setup.ts"],
    setupFiles: ["tests/unit/setup.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://foto:foto@localhost:5432/foto_test",
      APP_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: "./.test-storage",
      ANTHROPIC_API_KEY: "",
      RESEND_API_KEY: "",
      SMTP_URL: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
});
