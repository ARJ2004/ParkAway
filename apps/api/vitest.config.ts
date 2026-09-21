import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 60_000, // Testcontainers-backed integration tests need headroom for image pull + container start
    hookTimeout: 60_000,
  },
});
