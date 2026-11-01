import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { parsePublicEnv } from "./src/lib/env";

// Refuse to start (dev, build or start) without the public Supabase configuration.
// `next typegen` (part of `pnpm typecheck`) also loads this file but never contacts
// Supabase, so it is exempt; Next.js documents that `typegen` appears in argv.
if (!process.argv.includes("typegen")) {
  parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  // The end-to-end tests build into their own directory (see playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@gb/ui", "@gb/db"],
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default createNextIntlPlugin()(nextConfig);
