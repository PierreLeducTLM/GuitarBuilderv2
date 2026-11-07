import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

const SESSION_COOKIE = "sb-test-auth-token";
const ACCOUNT = { email: "bench@example.com", password: "spruce123", id: "shared-user" };

interface CookieOptions {
  path?: string;
}
interface CookieMethods {
  getAll(): { name: string; value: string }[];
  setAll(
    cookies: { name: string; value: string; options: CookieOptions }[],
    headers: Record<string, string>,
  ): void;
}

// The authentication service: knows one account, and a session is its cookie.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: CookieMethods }) => ({
    auth: {
      async getClaims() {
        const session = cookies.getAll().find((cookie) => cookie.name === SESSION_COOKIE);
        return { data: session ? { claims: { sub: session.value } } : null, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        if (email !== ACCOUNT.email || password !== ACCOUNT.password) {
          return { data: { user: null, session: null }, error: { message: "Invalid login" } };
        }
        cookies.setAll([{ name: SESSION_COOKIE, value: ACCOUNT.id, options: { path: "/" } }], {});
        return { data: { user: { id: ACCOUNT.id }, session: {} }, error: null };
      },
    },
  }),
}));

function visit(path: string, { session }: { session?: string } = {}) {
  const request = new NextRequest(new URL(path, "https://guitar.example"));
  if (session) request.cookies.set(SESSION_COOKIE, session);
  return proxy(request);
}

function location(response: Response) {
  const target = response.headers.get("location");
  return target ? new URL(target).pathname + new URL(target).search : null;
}

const sessionCookie = (response: Awaited<ReturnType<typeof proxy>>) =>
  response.cookies.get(SESSION_COOKIE)?.value;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable");
  vi.stubEnv("SHARED_ACCOUNT_EMAIL", "");
  vi.stubEnv("SHARED_ACCOUNT_PASSWORD", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function configureSharedAccount(password = ACCOUNT.password) {
  vi.stubEnv("SHARED_ACCOUNT_EMAIL", ACCOUNT.email);
  vi.stubEnv("SHARED_ACCOUNT_PASSWORD", password);
}

describe("access gate without a shared account", () => {
  it("sends a visitor without a session to the sign-in screen", async () => {
    const response = await visit("/builds");
    expect(location(response)).toBe("/sign-in?next=%2Fbuilds");
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("serves the sign-in screen", async () => {
    expect(location(await visit("/sign-in"))).toBeNull();
  });
});

describe("access gate with a shared account", () => {
  it("signs a visitor without a session in and serves the requested section", async () => {
    configureSharedAccount();
    const response = await visit("/builds");
    expect(location(response)).toBeNull();
    expect(sessionCookie(response)).toBe(ACCOUNT.id);
  });

  it("sends the sign-in URL on to its destination", async () => {
    configureSharedAccount();
    expect(location(await visit("/sign-in"))).toBe("/builds");
    expect(location(await visit("/sign-in?next=%2Fchat"))).toBe("/chat");
  });

  it("keeps the new session on redirects", async () => {
    configureSharedAccount();
    const response = await visit("/");
    expect(location(response)).toBe("/builds");
    expect(sessionCookie(response)).toBe(ACCOUNT.id);
  });

  it("keeps an existing session", async () => {
    configureSharedAccount();
    const response = await visit("/builds", { session: "someone-else" });
    expect(location(response)).toBeNull();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("does not sign in on the public story page", async () => {
    configureSharedAccount();
    const response = await visit("/story/abc123");
    expect(location(response)).toBeNull();
    expect(sessionCookie(response)).toBeUndefined();
  });

  it("falls back to the sign-in screen when the shared account is refused", async () => {
    configureSharedAccount("wrong-password");
    expect(location(await visit("/builds"))).toBe("/sign-in?next=%2Fbuilds");
    expect(location(await visit("/sign-in"))).toBeNull();
  });
});
