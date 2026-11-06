import { defineConfig, devices } from "@playwright/test";

/**
 * The legacy import rehearsal's browser check (scripts/legacy-import/rehearse.sh): builds the
 * app into `.next-rehearsal` against the rehearsal's v2 stack and opens what the import wrote.
 * Needs REHEARSAL_SUPABASE_URL and REHEARSAL_SUPABASE_KEY (the stack's publishable key).
 */
const APP_PORT = 3200;
const appUrl = `http://127.0.0.1:${APP_PORT}`;
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./e2e-rehearsal",
  testMatch: "**/*.spec.ts",
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `next build && next start --hostname 127.0.0.1 --port ${APP_PORT}`,
    url: `${appUrl}/sign-in`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-rehearsal",
      NEXT_PUBLIC_SUPABASE_URL: process.env.REHEARSAL_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.REHEARSAL_SUPABASE_KEY ?? "",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
