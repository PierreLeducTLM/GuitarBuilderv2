import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

type Messages = typeof import("../messages/en.json");

function catalog(locale: "en" | "fr"): Messages {
  return JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
}

export const en = catalog("en");
export const fr = catalog("fr");

const FAKE_SUPABASE = "http://127.0.0.1:54339";

/** Controls the fake Supabase server (e2e/fake-supabase.ts). */
export const fakeSupabase = {
  url: FAKE_SUPABASE,
  async reset() {
    await fetch(`${FAKE_SUPABASE}/__test/reset`, { method: "POST" });
  },
  async addUser(email: string, password: string) {
    const response = await fetch(`${FAKE_SUPABASE}/__test/users`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return (await response.json()) as { id: string; role: "user" | "admin" };
  },
  async configure(config: {
    failLogout?: boolean;
    failSignIn?: boolean;
    requireConfirmation?: boolean;
    signInDelayMs?: number;
    failBuildList?: boolean;
    failBuildInsert?: boolean;
    buildInsertDelayMs?: number;
    failBuildDelete?: boolean;
    failStepChanges?: boolean;
    failUploadsMatching?: string | null;
    uploadDelayMs?: number;
    failStorageRemove?: boolean;
  }) {
    await fetch(`${FAKE_SUPABASE}/__test/config`, { method: "POST", body: JSON.stringify(config) });
  },
  /** Creates a build directly, as if it had been made earlier. */
  async seedBuild(build: SeedBuild): Promise<StoredBuild> {
    const response = await fetch(`${FAKE_SUPABASE}/__test/builds`, {
      method: "POST",
      body: JSON.stringify(build),
    });
    return (await response.json()) as StoredBuild;
  },
  /** Every stored build, of every user. */
  async builds(): Promise<StoredBuild[]> {
    return (await (await fetch(`${FAKE_SUPABASE}/__test/builds`)).json()) as StoredBuild[];
  },
  /** Every stored photo file path. */
  async objects(): Promise<string[]> {
    return (await (await fetch(`${FAKE_SUPABASE}/__test/objects`)).json()) as string[];
  },
};

export interface SeedBuild {
  ownerEmail: string;
  name: string;
  guitar_type?: "classical" | "steel_string" | null;
  bobo_neck?: boolean;
  created_at?: string;
  sequence_state?: Record<string, unknown>[];
  id?: string;
}

export interface StoredBuild {
  id: string;
  owner_id: string;
  name: string;
  guitar_type: "classical" | "steel_string" | null;
  bobo_neck: boolean;
  sequence_state: {
    key: string;
    completed?: boolean;
    notes?: string;
    photos?: { url: string; name: string }[];
    measurements?: {
      id: string;
      description: string;
      frequency: number;
      roles?: Record<string, { frequency: number; origin: string }>;
    }[];
  }[];
  created_at: string;
  updated_at: string;
}

export const ADMIN = { email: "admin@example.com", password: "spruce123" };
export const LUTHIER = { email: "luthier@example.com", password: "spruce123" };

/** A fresh installation with an administrator (first account) and a regular user. */
export async function seedAccounts() {
  await fakeSupabase.reset();
  await fakeSupabase.addUser(ADMIN.email, ADMIN.password);
  await fakeSupabase.addUser(LUTHIER.email, LUTHIER.password);
}

export async function fillCredentials(page: Page, email: string, password: string) {
  await page.getByLabel(en.auth.email, { exact: true }).fill(email);
  await page.getByLabel(en.auth.password, { exact: true }).fill(password);
}

/** Opens `path`, signs in on the sign-in screen it redirects to, and waits for `path`. */
export async function signIn(
  page: Page,
  account: { email: string; password: string },
  path = "/builds",
) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/sign-in/);
  await fillCredentials(page, account.email, account.password);
  await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** The sign-in form's message area (Next.js also renders a route announcer with role=alert). */
export const formAlert = (page: Page) => page.locator("form").getByRole("alert");

/** Toasts raised with type error. */
export const errorToast = (page: Page) =>
  page.getByRole("region", { name: en.toast.region }).getByRole("alert");

/** Records requests to the authentication service, to prove validation sent none. */
export function watchAuthRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(`${FAKE_SUPABASE}/auth/`)) seen.push(request.url());
  });
  return seen;
}
