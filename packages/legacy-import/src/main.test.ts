import { describe, expect, it, vi } from "vitest";
import type { ImportConfig } from "./config.ts";
import { endsFor, type MainDeps, main } from "./main.ts";
import { ends as fakeEnds } from "./test-support/fake-ends.ts";

const hostedEnv = {
  SUPABASE_ACCESS_TOKEN: "sbp_token",
  LEGACY_SUPABASE_PROJECT_REF: "legacyref",
  SUPABASE_PROJECT_REF: "targetref",
};

const deps = (overrides: Partial<MainDeps> = {}) => {
  const out: string[] = [];
  const err: string[] = [];
  const files = new Map<string, string>();
  const value: MainDeps = {
    argv: [],
    env: hostedEnv,
    cwd: "/repo",
    now: () => new Date("2026-11-06T18:45:07Z"),
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    makeEnds: vi.fn(async () => fakeEnds().ends),
    ...overrides,
  };
  return { deps: value, out, err, files };
};

describe("main", () => {
  it("runs a dry run by default, writes both reports and prints the summary", async () => {
    const { deps: d, out, files } = deps();

    await expect(main(d)).resolves.toBe(0);

    expect([...files.keys()]).toEqual([
      "/repo/reports/legacy-import/20261106T184507Z-dry-run.md",
      "/repo/reports/legacy-import/20261106T184507Z-dry-run.json",
    ]);
    expect(d.mkdir).toHaveBeenCalledWith("/repo/reports/legacy-import");
    expect(out.join("\n")).toContain("First-version project: legacyref");
    expect(out.join("\n")).toContain("Target project: targetref");
    expect(out.join("\n")).toContain("Mode: dry run (nothing written)");
    expect(out.join("\n")).toContain("Report: reports/legacy-import/20261106T184507Z-dry-run.md");
    expect(out.join("\n")).toContain("JSON: reports/legacy-import/20261106T184507Z-dry-run.json");
    expect(out.join("\n")).not.toMatch(/@/);
  });

  it("writes the report contents", async () => {
    const { deps: d, files } = deps();

    await main(d);

    expect(files.get("/repo/reports/legacy-import/20261106T184507Z-dry-run.md")).toContain(
      "# Legacy import report: dry run",
    );
    expect(
      JSON.parse(files.get("/repo/reports/legacy-import/20261106T184507Z-dry-run.json") ?? "{}"),
    ).toMatchObject({ mode: "dry-run", sourceProject: "legacyref", targetProject: "targetref" });
  });

  it("applies with --apply", async () => {
    const { deps: d, files } = deps({ argv: ["--apply"] });

    await expect(main(d)).resolves.toBe(0);

    expect([...files.keys()][0]).toBe("/repo/reports/legacy-import/20261106T184507Z-apply.md");
  });

  it("exits with 1 when a record failed", async () => {
    const failing = fakeEnds({ failExecute: (sql) => sql.includes("public.wood_panels") });
    const { deps: d } = deps({ argv: ["--apply"], makeEnds: async () => failing.ends });

    await expect(main(d)).resolves.toBe(1);
  });

  it("refuses an unknown option with the usage", async () => {
    const { deps: d, err } = deps({ argv: ["--aply"] });

    await expect(main(d)).resolves.toBe(2);

    expect(err).toEqual(["Unknown option: --aply. Usage: pnpm legacy:import [--apply]"]);
    expect(d.makeEnds).not.toHaveBeenCalled();
  });

  it("prints the usage with --help", async () => {
    const { deps: d, out } = deps({ argv: ["--help"] });

    await expect(main(d)).resolves.toBe(0);

    expect(out[0]).toContain("Usage: pnpm legacy:import [--apply]");
    expect(d.makeEnds).not.toHaveBeenCalled();
  });

  it("refuses to start without its settings", async () => {
    const { deps: d, err } = deps({ env: {} });

    await expect(main(d)).resolves.toBe(2);

    expect(err[0]).toContain("Missing settings: SUPABASE_ACCESS_TOKEN");
    expect(d.makeEnds).not.toHaveBeenCalled();
  });

  it("names the local stacks by their Supabase URLs, never the database URLs", async () => {
    const { deps: d, out } = deps({
      env: {
        LEGACY_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:58322/postgres",
        LEGACY_SUPABASE_URL: "http://127.0.0.1:58321",
        TARGET_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:57322/postgres",
        TARGET_SUPABASE_URL: "http://127.0.0.1:57321",
        TARGET_SERVICE_KEY: "sb_secret_local",
      },
    });

    await main(d);

    expect(out.join("\n")).toContain("First-version project: http://127.0.0.1:58321");
    expect(out.join("\n")).toContain("Target project: http://127.0.0.1:57321");
    expect(out.join("\n")).not.toContain("secret");
  });

  it("stops with 1 and the reason when the run fails", async () => {
    const broken = fakeEnds();
    const {
      deps: d,
      err,
      files,
    } = deps({
      makeEnds: async () => ({
        ...broken.ends,
        source: {
          ...broken.ends.source,
          sql: {
            query: async () => {
              throw new Error("SQL request failed (401): Unauthorized");
            },
            execute: async () => undefined,
          },
        },
      }),
    });

    await expect(main(d)).resolves.toBe(1);

    expect(err).toEqual(["Import stopped: SQL request failed (401): Unauthorized"]);
    expect(files.size).toBe(0);
  });
});

describe("endsFor", () => {
  const keys = [{ name: "default", type: "secret", api_key: "sb_secret_target" }];

  it("connects to the hosted projects over HTTPS, the first version read-only", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(keys)));
    const config: ImportConfig = {
      mode: "hosted",
      accessToken: "sbp_token",
      legacyProjectRef: "legacyref",
      targetProjectRef: "targetref",
    };

    const ends = await endsFor(config, { fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/projects/targetref/api-keys?reveal=true",
      { headers: { Authorization: "Bearer sbp_token" } },
    );
    expect(ends.source.supabaseUrl).toBe("https://legacyref.supabase.co");
    expect(ends.target.storage.publicUrl("step-photos", "a/b/c.jpg")).toBe(
      "https://targetref.supabase.co/storage/v1/object/public/step-photos/a/b/c.jpg",
    );
    await expect(ends.source.sql.execute("delete from auth.users")).rejects.toThrow("read-only");
    await expect(ends.source.sql.query("delete from auth.users")).rejects.toThrow("read-only");
  });

  it("sends hosted SQL to each project's Management API endpoint", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) =>
      String(input).includes("api-keys")
        ? new Response(JSON.stringify(keys))
        : new Response("[]", { status: 201 }),
    );
    const ends = await endsFor(
      {
        mode: "hosted",
        accessToken: "t",
        legacyProjectRef: "legacyref",
        targetProjectRef: "targetref",
      },
      { fetch: fetchFn },
    );

    await ends.source.sql.query("select 1");
    await ends.target.sql.execute("select 1");

    const urls = fetchFn.mock.calls.map(([input]) => String(input));
    expect(urls).toContain("https://api.supabase.com/v1/projects/legacyref/database/query");
    expect(urls).toContain("https://api.supabase.com/v1/projects/targetref/database/query");
  });

  it("connects to local stacks with their URLs and key, the first version read-only", async () => {
    const config: ImportConfig = {
      mode: "local",
      legacyDatabaseUrl: "postgresql://l",
      legacySupabaseUrl: "http://127.0.0.1:58321",
      targetDatabaseUrl: "postgresql://t",
      targetSupabaseUrl: "http://127.0.0.1:57321",
      targetServiceKey: "sb_secret_local",
    };

    const ends = await endsFor(config, {});

    expect(ends.source.supabaseUrl).toBe("http://127.0.0.1:58321");
    expect(ends.target.storage.publicUrl("step-photos", "a/b/c.jpg")).toBe(
      "http://127.0.0.1:57321/storage/v1/object/public/step-photos/a/b/c.jpg",
    );
    await expect(ends.source.sql.execute("select 1")).rejects.toThrow("read-only");
  });
});
