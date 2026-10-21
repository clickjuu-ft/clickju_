import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

export default function globalSetup() {
  rmSync(".e2e-storage", { recursive: true, force: true });
  execSync("npx tsx --conditions=react-server --tsconfig tsconfig.json scripts/e2e-fixtures.ts", { stdio: "inherit", env: process.env });
}
