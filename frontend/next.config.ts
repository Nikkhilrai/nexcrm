import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*/",
        destination: "http://8.231.72.255/api/:path*/",
      },
      {
        source: "/api/:path*",
        destination: "http://8.231.72.255/api/:path*/",
      },
    ];
  },
};

export default nextConfig;
