const path = require("node:path");

// `preset` config keys are REPLACED, not merged, by anything set alongside
// them in this file — so appending to jest-expo's own setupFiles (which
// installs the expo/RN polyfills every test needs) means reading its actual
// list here rather than clobbering it with just our own file.
const jestExpoPreset = require("jest-expo/jest-preset.js");

/** Component tests (RNTL) only — pure-logic tests stay on Vitest (see vitest.config.ts). */
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.tsx"],
  setupFiles: [...jestExpoPreset.setupFiles, path.resolve(__dirname, "jest.setup.js")],
  // jest-expo's own default (see jest-expo/jest-preset.js), extended with
  // @parkaway so our workspace packages (raw TS, no build step) get transformed too.
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@parkaway))",
  ],
  // @parkaway/ui-native (and other workspace packages) declare react/react-native as
  // peerDependencies and resolve them from THEIR OWN location, which — in this npm
  // workspace — is the root's react@18 (kept there for driver-web/admin-web), not this
  // app's nested react@19. Two live React copies breaks every hook (context reads null).
  // Force every consumer, wherever it's required from, onto this app's single copy.
  moduleNameMapper: {
    ...jestExpoPreset.moduleNameMapper,
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^react/(.*)$": path.resolve(__dirname, "node_modules/react/$1"),
  },
};
