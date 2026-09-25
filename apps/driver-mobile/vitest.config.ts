import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Component tests (.test.tsx, RNTL) run under Jest — see jest.config.js.
    include: ["src/**/*.test.ts"],
  },
});
