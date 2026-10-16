import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: ["src/core/**/*.test.ts", "src/core/test-utils.ts"],
      reporter: ["text", "json-summary"],
      // NFR-10: core logic coverage >= 90%
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
