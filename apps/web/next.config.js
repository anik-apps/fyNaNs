/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@fynans/api-client", "@fynans/shared-types"],
  output: "standalone",
};

module.exports = nextConfig;
