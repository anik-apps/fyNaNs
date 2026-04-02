const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root for workspace package changes
config.watchFolders = [monorepoRoot];

// Resolve packages from the monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Ensure Metro resolves workspace packages' source files
config.resolver.disableHierarchicalLookup = false;

// Support pnpm symlinked packages
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Force single copies of React to prevent duplicate React crash
// pnpm hoisting can create nested copies that break hooks
const singletonPackages = {
  react: path.resolve(monorepoRoot, "node_modules/react"),
  "react/jsx-runtime": path.resolve(monorepoRoot, "node_modules/react/jsx-runtime"),
  "react/jsx-dev-runtime": path.resolve(monorepoRoot, "node_modules/react/jsx-dev-runtime"),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonPackages[moduleName]) {
    return {
      filePath: require.resolve(singletonPackages[moduleName]),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
