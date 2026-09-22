// @ts-check
import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignores = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.expo/**",
  "**/drizzle/**", // generated SQL migrations, not source
  "apps/driver-mobile/expo-env.d.ts",
];

// Shared, non-type-checked TS rules — kept fast and dependency-light across a
// monorepo with several independent tsconfigs, rather than wiring up
// type-aware linting (typescript-eslint's `recommendedTypeChecked`) per
// project. `tsc -b`/`tsc --noEmit` in each workspace is what actually
// guarantees type correctness; this config's job is catching the other class
// of bug (unused code, hook misuse, accidental console logs) cheaply.
const baseTsRules = {
  ...js.configs.recommended.rules,
  ...tseslint.configs.recommended.reduce((acc, c) => ({ ...acc, ...c.rules }), {}),
  "@typescript-eslint/no-unused-vars": [
    "warn",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-explicit-any": "warn",
  "no-console": ["warn", { allow: ["warn", "error"] }],
};

// Catches exactly the mistake that's broken this monorepo's Vite/Metro
// bundling twice already (see CLAUDE.md's ".js-import-extension trap"):
// writing a relative import with a `.js` suffix — a habit that's only
// correct in apps/api (strict Node ESM), copied by muscle memory into
// everywhere else, where Vite/Metro don't resolve it to the `.ts` source.
const noJsExtensionOnRelativeImportsRules = {
  "no-restricted-syntax": [
    "warn",
    {
      selector: "ImportDeclaration[source.value=/^\\.{1,2}\\/.*\\.js$/]",
      message: "Relative imports here must NOT have a .js extension (Vite/Metro won't resolve it to the .ts source) — only apps/api needs that.",
    },
    {
      selector: "ExportNamedDeclaration[source.value=/^\\.{1,2}\\/.*\\.js$/]",
      message: "Relative re-exports here must NOT have a .js extension (Vite/Metro won't resolve it to the .ts source) — only apps/api needs that.",
    },
  ],
};

const reactRules = {
  ...reactPlugin.configs.flat.recommended.rules,
  ...reactHooksPlugin.configs.recommended.rules,
  "react/react-in-jsx-scope": "off", // not needed with the modern JSX transform
  "react/prop-types": "off", // TypeScript is the source of truth for prop shapes here
  // Not in "recommended" by default, but worth enabling: a handful of fixed-
  // length, never-reordered arrays (OTP digit boxes, wizard progress dots)
  // deliberately use index-as-key with an explaining eslint-disable comment
  // — enabling the rule is what makes those disables meaningful instead of
  // silently dead.
  "react/no-array-index-key": "warn",
};

export default tseslint.config(
  { ignores },

  // --- apps/api: Node backend, strict Node ESM (explicit .js import extensions are intentional here) ---
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: { ...globals.node },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: baseTsRules,
  },

  // --- packages/design-tokens, packages/ui-web: platform-agnostic / DOM, consumed by Vite (no .js import extensions) ---
  {
    files: ["packages/design-tokens/**/*.ts", "packages/ui-web/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { "@typescript-eslint": tseslint.plugin, react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: { ...baseTsRules, ...reactRules, ...noJsExtensionOnRelativeImportsRules },
    settings: { react: { version: "18.3" } },
  },

  // --- apps/driver-web, apps/admin-web: React + Vite (browser) ---
  {
    files: ["apps/driver-web/**/*.{ts,tsx}", "apps/admin-web/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { "@typescript-eslint": tseslint.plugin, react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: { ...baseTsRules, ...reactRules, ...noJsExtensionOnRelativeImportsRules },
    settings: { react: { version: "18.3" } },
  },

  // --- apps/driver-mobile, packages/ui-native: React Native + Expo/Metro ---
  {
    files: ["apps/driver-mobile/**/*.{ts,tsx}", "packages/ui-native/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
      globals: { ...globals.node }, // RN's runtime globals aren't a standard `globals` set; Node covers process.env usage, which is all this code reads
    },
    plugins: { "@typescript-eslint": tseslint.plugin, react: reactPlugin, "react-hooks": reactHooksPlugin },
    rules: { ...baseTsRules, ...reactRules, ...noJsExtensionOnRelativeImportsRules },
    settings: { react: { version: "18.3" } },
  },

  // --- Test files everywhere: relax no-explicit-any and no-console a little (mocks, debug output) ---
  {
    files: ["**/*.test.{ts,tsx}", "**/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  // --- CLI scripts (migrations, seeding): console.log IS the intended output, not debug noise ---
  {
    files: ["apps/api/src/scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },

  // --- Config files at each package root: allow default (unnamed) exports, Node globals ---
  {
    files: ["**/*.config.{js,ts}", "**/vite.config.ts", "**/vitest.config.ts", "**/drizzle.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  }
);
