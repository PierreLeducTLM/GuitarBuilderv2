import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@gb/ui", "@gb/db"],
};

export default nextConfig;
