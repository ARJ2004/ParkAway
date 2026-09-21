import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts runs with globals: false (consistent with the rest of this
// codebase's explicit-import style), so RTL's auto-cleanup — which detects a
// global `afterEach` — never registers on its own. Wire it explicitly instead.
afterEach(() => {
  cleanup();
});
