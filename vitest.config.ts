import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next preserves JSX for its compiler; Vitest must transform it for component tests.
  oxc: { jsx: { runtime: "automatic" } },
  // next/font only runs inside the Next compiler; tests use a stand-in.
  resolve: {
    alias: { "next/font/google": fileURLToPath(new URL("./apps/web/src/test/next-font-google.ts", import.meta.url)) },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "services/*/src/**/*.test.ts",
      "apps/*/**/*.test.{ts,tsx}",
      "scripts/*/src/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
