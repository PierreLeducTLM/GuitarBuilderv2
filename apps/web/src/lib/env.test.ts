import { describe, expect, it } from "vitest";
import { ConfigurationError, parsePublicEnv } from "./env";

describe("parsePublicEnv", () => {
  it("accepts a URL and a key", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://abc.supabase.co ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      }),
    ).toEqual({ supabaseUrl: "https://abc.supabase.co", supabaseAnonKey: "anon" });
  });

  it("refuses to start without configuration, naming both variables", () => {
    expect(() => parsePublicEnv({})).toThrow(ConfigurationError);
    expect(() => parsePublicEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL is not set; NEXT_PUBLIC_SUPABASE_ANON_KEY is not set/,
    );
    expect(() => parsePublicEnv({})).toThrow(/\.env\.example/);
  });

  it("refuses an empty key or a malformed URL", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: " ",
      }),
    ).toThrow(/ANON_KEY is not set/);
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "localhost:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      }),
    ).toThrow(/not an http\(s\) URL/);
  });
});
