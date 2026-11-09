import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next preserves JSX for its compiler; Vitest must transform it for component tests.
  oxc: { jsx: { runtime: "automatic" } },
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
