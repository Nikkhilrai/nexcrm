import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lock the workspace root to this dir so a stray lockfile elsewhere can't
  // confuse Turbopack's autodetection.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
