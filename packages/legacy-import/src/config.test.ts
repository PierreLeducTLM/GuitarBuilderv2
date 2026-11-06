import { describe, expect, it } from "vitest";
import { readConfig } from "./config.ts";

const hostedEnv = (overrides: Record<string, string | undefined> = {}) => ({
  SUPABASE_ACCESS_TOKEN: "sbp_token",
  LEGACY_SUPABASE_PROJECT_REF: "legacyref",
  SUPABASE_PROJECT_REF: "targetref",
  ...overrides,
});

const localEnv = (overrides: Record<string, string | undefined> = {}) => ({
  LEGACY_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:58322/postgres",
  LEGACY_SUPABASE_URL: "http://127.0.0.1:58321",
  TARGET_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:57322/postgres",
  TARGET_SUPABASE_URL: "http://127.0.0.1:57321",
  TARGET_SERVICE_KEY: "sb_secret_local",
  ...overrides,
});

describe("readConfig", () => {
  it("reads the hosted settings", () => {
    expect(readConfig(hostedEnv())).toEqual({
      ok: true,
      config: {
        mode: "hosted",
        accessToken: "sbp_token",
        legacyProjectRef: "legacyref",
        targetProjectRef: "targetref",
      },
    });
  });

  it("reads the local settings when a local variable is present", () => {
    expect(readConfig(localEnv())).toEqual({
      ok: true,
      config: {
        mode: "local",
        legacyDatabaseUrl: "postgresql://postgres:postgres@127.0.0.1:58322/postgres",
        legacySupabaseUrl: "http://127.0.0.1:58321",
        targetDatabaseUrl: "postgresql://postgres:postgres@127.0.0.1:57322/postgres",
        targetSupabaseUrl: "http://127.0.0.1:57321",
        targetServiceKey: "sb_secret_local",
      },
    });
  });

  it("names every missing hosted variable", () => {
    expect(readConfig({ LEGACY_SUPABASE_PROJECT_REF: "legacyref" })).toEqual({
      ok: false,
      message:
        "Missing settings: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF. Set them to import from the hosted first-version project.",
    });
  });

  it("treats blank values as missing", () => {
    expect(readConfig(hostedEnv({ SUPABASE_ACCESS_TOKEN: "  " }))).toEqual({
      ok: false,
      message:
        "Missing settings: SUPABASE_ACCESS_TOKEN. Set them to import from the hosted first-version project.",
    });
  });

  it("names every missing local variable once one local variable is set", () => {
    expect(
      readConfig(localEnv({ TARGET_SERVICE_KEY: undefined, LEGACY_SUPABASE_URL: "" })),
    ).toEqual({
      ok: false,
      message:
        "Missing settings: LEGACY_SUPABASE_URL, TARGET_SERVICE_KEY. Set them to import between local stacks.",
    });
  });

  it("refuses the same hosted project as source and target", () => {
    expect(readConfig(hostedEnv({ SUPABASE_PROJECT_REF: "legacyref" }))).toEqual({
      ok: false,
      message: "The first-version project and the target project are the same (legacyref).",
    });
  });

  it("refuses the same local database as source and target", () => {
    const sameDatabase = localEnv({
      TARGET_DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:58322/postgres",
    });
    expect(readConfig(sameDatabase)).toEqual({
      ok: false,
      message:
        "The first-version project and the target project are the same (postgresql://postgres:postgres@127.0.0.1:58322/postgres).",
    });
  });

  it("refuses the same local Supabase URL as source and target", () => {
    expect(readConfig(localEnv({ TARGET_SUPABASE_URL: "http://127.0.0.1:58321" }))).toEqual({
      ok: false,
      message:
        "The first-version project and the target project are the same (http://127.0.0.1:58321).",
    });
  });
});
