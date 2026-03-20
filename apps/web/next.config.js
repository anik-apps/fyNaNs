/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@fynans/api-client", "@fynans/shared-types"],
  output: "standalone",
  async rewrites() {
    // Proxy /api/* to the backend in development.
    // This makes API calls same-origin, so cookies work without cross-origin issues.
    // In production, Caddy handles this routing — no rewrite needed.
    if (process.env.NODE_ENV === "production") {
      return [];
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
