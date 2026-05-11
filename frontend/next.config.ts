import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Prevent Next.js from stripping trailing slashes before Vercel rewrites them.
  // Without this, /api/auth/login/ → 308 → /api/auth/login, breaking Django URLs.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
