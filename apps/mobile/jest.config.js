module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest-setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|@fynans/shared-types))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^react-test-renderer(.*)$":
      "<rootDir>/../../node_modules/.pnpm/react-test-renderer@19.2.0_react@19.1.0/node_modules/react-test-renderer$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};
