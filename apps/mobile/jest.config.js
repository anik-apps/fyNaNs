module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest-setup.ts"],
  // First test in a suite pays react-native's cold-render cost, which can
  // exceed jest's 5s default on contended CI runners.
  testTimeout: 15000,
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|@fynans/shared-types))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react$": "<rootDir>/../../node_modules/react",
    "^react-test-renderer$": "<rootDir>/../../node_modules/react-test-renderer",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
