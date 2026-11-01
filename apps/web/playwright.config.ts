import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. `pnpm test:e2e` builds the app into `.next-e2e` with test
 * configuration pointing at the fake Supabase server (e2e/fake-supabase.ts), starts
 * both, and runs the specs on a desktop and a phone viewport.
 *
 * Browsers: @playwright/test is pinned to the version of the preinstalled browsers.
 * Set PW_CHROMIUM_EXECUTABLE (e.g. /opt/pw-browsers/chromium) to use another binary.
 */
const APP_PORT = 3100;
const FAKE_SUPABASE_PORT = 54339;
const appUrl = `http://127.0.0.1:${APP_PORT}`;
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // The specs share one fake server whose state each test resets.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_500 },
  use: {
    baseURL: appUrl,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
      grepInvert: /@phone/,
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
      grep: /@phone/,
    },
  ],
  webServer: [
    {
      command: `node e2e/fake-supabase.ts ${FAKE_SUPABASE_PORT}`,
      port: FAKE_SUPABASE_PORT,
      reuseExistingServer: false,
    },
    {
      command: `next build && next start --hostname 127.0.0.1 --port ${APP_PORT}`,
      url: `${appUrl}/sign-in`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${FAKE_SUPABASE_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
