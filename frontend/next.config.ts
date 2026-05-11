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
        destination: "http://34.56.168.240/api/:path*/",
      },
      {
        source: "/api/:path*",
        destination: "http://34.56.168.240/api/:path*/",
      },
    ];
  },
};

export default nextConfig;
