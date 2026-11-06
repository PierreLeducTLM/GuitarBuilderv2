import { describe, expect, it, vi } from "vitest";
import { type Ends, runImport } from "./run.ts";
import type { Row, SqlExecutor } from "./transport/sql.ts";
import type { Download, SourceStorage, TargetStorage } from "./transport/storage.ts";

const OWNER = "b0000000-0000-4000-8000-00000000000b";
const CONFLICT = "c0000000-0000-4000-8000-00000000000c";
const BUILD = "e0000000-0000-4000-8000-00000000000e";
const BUILD_2 = "e0000000-0000-4000-8000-0000000000e2";
const CONFLICT_BUILD = "e0000000-0000-4000-8000-0000000000ee";
const LEGACY_URL = "https://legacy.supabase.co";

const panel = (id: string, userId: string | null) => ({
  id,
  user_id: userId,
  name: "Sitka",
  sample_length: 602,
  sample_width: 283,
  sample_thickness: 3.8,
  sample_mass: 270,
  freq_longitudinal: 140,
  freq_cross_grain: 57,
  freq_diagonal: 90,
  target_plate_length: 520,
  target_plate_width: 200,
  vibrational_stiffness_param: 75,
  young_modulus_cross: 0.28,
  target_thickness: 2.9,
  estimated_panel_mass: 150,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
});

const build = (id: string, userId: string, photos: string[]) => ({
  row: {
    id,
    user_id: userId,
    text_identifier: `Build ${id.slice(-2)}`,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
    sequence_diagram: {
      nodes: [
        { id: "TrussRod", completed: true, photos: photos.map((fileName) => ({ fileName })) },
      ],
    },
  },
});

/** Answers each query with the first fixture whose key the SQL contains, and logs every call. */
const fakeSql = (
  fixtures: Readonly<Record<string, readonly Row[]>>,
  log: string[],
  name: string,
  failExecute: (sql: string) => boolean = () => false,
) => {
  const executor: SqlExecutor = {
    query: vi.fn(async (sql: string) => {
      log.push(`${name}.query ${sql.slice(0, 60)}`);
      const key = Object.keys(fixtures).find((candidate) => sql.includes(candidate));
      if (key === undefined) throw new Error(`unexpected query: ${sql}`);
      return fixtures[key] ?? [];
    }),
    execute: vi.fn(async (sql: string) => {
      const kind = /insert into (\S+)/.exec(
        sql.split("\n").find((l) => l.startsWith("insert")) ?? "",
      )?.[1];
      const id = /"id":"([^"]+)"/.exec(sql)?.[1];
      if (failExecute(sql)) throw new Error(`boom ${kind}`);
      log.push(`${name}.execute ${kind} ${id}`);
    }),
  };
  return executor;
};

const legacyFixtures = {
  "from auth.users": [
    { row: { id: OWNER, email: "owner@example.com" } },
    { row: { id: CONFLICT, email: "taken@example.com" } },
  ],
  "from auth.identities": [],
  "from public.user_profiles": [{ id: OWNER, role: "admin" }],
  "from public.guitar_builds": [
    build(BUILD, OWNER, [`${BUILD}/TrussRod/1_a.jpg`, `${BUILD}/TrussRod/2_gone.jpg`]),
    build(BUILD_2, OWNER, [`${BUILD_2}/TrussRod/3_c.jpg`]),
    build(CONFLICT_BUILD, CONFLICT, [`${CONFLICT_BUILD}/TrussRod/4_d.jpg`]),
  ],
  "from public.wood_panels": [{ row: panel("p1", OWNER) }, { row: panel("p2", null) }],
  "from public.default_wood_panels": [{ row: panel("d1", null) }],
  "from storage.objects": [{ name: `${BUILD}/TrussRod/1_a.jpg` }],
  "from auth.mfa_factors": [{ count: 0 }],
  query_to_xml: [],
};

const targetFixtures = {
  "from information_schema.columns": [
    { table_name: "users", column_name: "id", is_generated: "NEVER" },
    { table_name: "users", column_name: "email", is_generated: "NEVER" },
  ],
  "select id, email from auth.users": [{ id: "v2", email: "taken@example.com" }],
  "select id from public.builds": [],
  "select id from public.wood_panels": [],
  "select id from public.default_wood_panels": [],
  "public.wood_e_cross_gpa": [
    { id: "p1", e_cross_gpa: 0.57, target_thickness_mm: 0.96, estimated_mass_g: 31.4 },
    { id: "d1", e_cross_gpa: 0.57, target_thickness_mm: 0.96, estimated_mass_g: 31.4 },
  ],
  "with ids as": [
    { accounts: 1, admins: 1, users: 0, builds: 1, panels: 1, default_panels: 1, photos: 1 },
  ],
};

type EndsOptions = {
  failUploadFor?: string;
  failExecute?: (sql: string) => boolean;
  legacy?: Partial<typeof legacyFixtures>;
  target?: Partial<typeof targetFixtures>;
};

const ends = (options: EndsOptions = {}) => {
  const log: string[] = [];
  const sourceStorage: SourceStorage = {
    download: vi.fn(async (url: string): Promise<Download> => {
      log.push(`download ${url.slice(url.lastIndexOf("/") + 1)}`);
      return url.includes("gone")
        ? { found: false, status: 404 }
        : { found: true, bytes: new Uint8Array([1]), contentType: "image/jpeg" };
    }),
    exists: vi.fn(async (url: string) => {
      log.push(`head ${url.slice(url.lastIndexOf("/") + 1)}`);
      return !url.includes("gone");
    }),
  };
  const targetStorage: TargetStorage = {
    upload: vi.fn(async ({ path }: { path: string }) => {
      if (options.failUploadFor !== undefined && path.includes(options.failUploadFor)) {
        throw new Error("Upload failed (500)");
      }
      log.push(`upload ${path}`);
    }),
    publicUrl: (bucket, path) =>
      `https://v2.supabase.co/storage/v1/object/public/${bucket}/${path}`,
  };
  const value: Ends = {
    source: {
      sql: fakeSql({ ...legacyFixtures, ...options.legacy }, log, "source"),
      storage: sourceStorage,
      supabaseUrl: LEGACY_URL,
    },
    target: {
      sql: fakeSql({ ...targetFixtures, ...options.target }, log, "target", options.failExecute),
      storage: targetStorage,
    },
  };
  return { ends: value, log, sourceStorage, targetStorage };
};

describe("runImport, dry run", () => {
  it("writes nothing and uploads nothing", async () => {
    const { ends: e, log, targetStorage } = ends();

    await runImport({ ends: e, apply: false });

    expect(log.filter((entry) => entry.startsWith("target.execute"))).toEqual([]);
    expect(targetStorage.upload).not.toHaveBeenCalled();
  });

  it("checks every photo of the imported builds and reports the missing ones", async () => {
    const { ends: e, log } = ends();

    const result = await runImport({ ends: e, apply: false });

    expect(log.filter((entry) => entry.startsWith("head"))).toEqual([
      "head 1_a.jpg",
      "head 2_gone.jpg",
      "head 3_c.jpg",
    ]);
    expect(result.photos.missing).toEqual([
      { build: BUILD, step: "TrussRod", path: `${BUILD}/TrussRod/2_gone.jpg` },
    ]);
    expect(result.photos.copied).toBe(0);
  });

  it("checks photos at the first-version project's public URLs", async () => {
    const { ends: e, sourceStorage } = ends();

    await runImport({ ends: e, apply: false });

    expect(sourceStorage.exists).toHaveBeenCalledWith(
      `${LEGACY_URL}/storage/v1/object/public/step-photos/${BUILD}/TrussRod/1_a.jpg`,
    );
  });

  it("reports panel values that v2 corrects, for panels and default panels", async () => {
    const { ends: e } = ends();

    const result = await runImport({ ends: e, apply: false });

    expect(result.panelChanges).toEqual([
      {
        table: "wood_panels",
        id: "p1",
        name: "Sitka",
        old: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: 150 },
        new: { eCrossGpa: 0.57, targetThicknessMm: 0.96, estimatedMassG: 31.4 },
      },
      {
        table: "default_wood_panels",
        id: "d1",
        name: "Sitka",
        old: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: 150 },
        new: { eCrossGpa: 0.57, targetThicknessMm: 0.96, estimatedMassG: 31.4 },
      },
    ]);
    expect(result.verification).toBeNull();
  });
});

describe("runImport, apply", () => {
  it("imports accounts, then each build after its photos, then panels, then checks", async () => {
    const { ends: e, log } = ends();

    await runImport({ ends: e, apply: true });

    const steps = log
      .filter((entry) => !entry.includes(".query") || entry.includes("with ids"))
      .map((entry) => entry.replace(/^(target\.query with ids as).*$/, "$1"));
    expect(steps).toEqual([
      `target.execute auth.users ${OWNER}`,
      "download 1_a.jpg",
      `upload ${BUILD}/TrussRod/1_a.jpg`,
      "download 2_gone.jpg",
      `target.execute public.builds ${BUILD}`,
      "download 3_c.jpg",
      `upload ${BUILD_2}/TrussRod/3_c.jpg`,
      `target.execute public.builds ${BUILD_2}`,
      "target.execute public.wood_panels p1",
      "target.execute public.default_wood_panels d1",
      "target.query with ids as",
    ]);
  });

  it("never writes the accounts, builds or panels of a skipped owner", async () => {
    const { ends: e, log } = ends();

    await runImport({ ends: e, apply: true });

    expect(log.some((entry) => entry.includes(CONFLICT))).toBe(false);
    expect(log.some((entry) => entry.includes(CONFLICT_BUILD))).toBe(false);
  });

  it("points the step at the copied photo and leaves a missing one out", async () => {
    const { ends: e } = ends();
    const execute = vi.spyOn(e.target.sql, "execute");

    const result = await runImport({ ends: e, apply: true });

    const buildSql =
      execute.mock.calls.map(([sql]) => sql).find((sql) => sql.includes(BUILD)) ?? "";
    expect(buildSql).toContain(
      `"photos":[{"url":"https://v2.supabase.co/storage/v1/object/public/step-photos/${BUILD}/TrussRod/1_a.jpg","name":"1_a.jpg"}]`,
    );
    expect(result.photos.copied).toBe(2);
    expect(result.photos.missing).toEqual([
      { build: BUILD, step: "TrussRod", path: `${BUILD}/TrussRod/2_gone.jpg` },
    ]);
  });

  it("uploads each photo with its content type", async () => {
    const { ends: e, targetStorage } = ends();

    await runImport({ ends: e, apply: true });

    expect(targetStorage.upload).toHaveBeenCalledWith({
      bucket: "step-photos",
      path: `${BUILD}/TrussRod/1_a.jpg`,
      bytes: new Uint8Array([1]),
      contentType: "image/jpeg",
    });
  });

  it("stops a build whose photo copy fails, reports it, and goes on with the others", async () => {
    const { ends: e, log } = ends({ failUploadFor: BUILD });

    const result = await runImport({ ends: e, apply: true });

    expect(log).not.toContain(`target.execute public.builds ${BUILD}`);
    expect(log).toContain(`target.execute public.builds ${BUILD_2}`);
    expect(result.failures).toEqual([
      { kind: "build", id: BUILD, name: "Build 0e", error: "Upload failed (500)" },
    ]);
  });

  it("records the post-apply check", async () => {
    const { ends: e } = ends();

    const result = await runImport({ ends: e, apply: true });

    expect(result.verification).toEqual({
      accounts: 1,
      admins: 1,
      users: 0,
      builds: 1,
      panels: 1,
      default_panels: 1,
      photos: 1,
    });
  });
});

describe("runImport, panels", () => {
  const queriesOf = (e: Ends): string[] =>
    vi.mocked(e.target.sql.query).mock.calls.map(([sql]) => sql);
  const executesOf = (e: Ends): string[] =>
    vi.mocked(e.target.sql.execute).mock.calls.map(([sql]) => sql);
  const checkedIds = (e: Ends) => {
    const sql = queriesOf(e).find((query) => query.startsWith("with ids as")) ?? "";
    return JSON.parse(/\$gb_[0-9a-f]+\$(.*)\$gb_[0-9a-f]+\$::jsonb/.exec(sql)?.[1] ?? "null");
  };

  it("asks v2 for the results of each planned panel's inputs", async () => {
    const { ends: e } = ends();

    await runImport({ ends: e, apply: false });

    const formulaQueries = queriesOf(e).filter((sql) => sql.includes("public.wood_e_cross_gpa"));
    expect(formulaQueries).toHaveLength(2);
    expect(formulaQueries[0]).toContain('"id":"p1","owner_id"');
    expect(formulaQueries[0]).toContain('"sample_length_mm":602');
    expect(formulaQueries[1]).toContain('"id":"d1","name":"Sitka","sample_length_mm":602');
  });

  it("reports no change for a panel v2 gave no results for", async () => {
    const { ends: e } = ends({
      target: {
        "public.wood_e_cross_gpa": [
          { id: "d1", e_cross_gpa: 0.57, target_thickness_mm: 0.96, estimated_mass_g: 31.4 },
        ],
      },
    });

    const result = await runImport({ ends: e, apply: false });

    expect(result.panelChanges.map((change) => change.id)).toEqual(["d1"]);
  });

  it("reports no change for a panel whose values v2 keeps", async () => {
    const { ends: e } = ends({
      target: {
        "public.wood_e_cross_gpa": [
          { id: "p1", e_cross_gpa: 0.28, target_thickness_mm: 2.9, estimated_mass_g: 150 },
        ],
      },
    });

    const result = await runImport({ ends: e, apply: false });

    expect(result.panelChanges).toEqual([]);
  });

  it("writes panels in batches of 50", async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ row: panel(`p${i + 1}`, OWNER) }));
    const { ends: e } = ends({ legacy: { "from public.wood_panels": many } });

    await runImport({ ends: e, apply: true });

    const batches = executesOf(e).filter((sql) => sql.includes("insert into public.wood_panels"));
    expect(batches).toHaveLength(2);
    expect(batches[0]).toContain('"id":"p1",');
    expect(batches[0]).toContain('"id":"p50",');
    expect(batches[0]).not.toContain('"id":"p51",');
    expect(batches[1]).toContain('"id":"p51",');
    expect(batches[1]).not.toContain('"id":"p50",');
  });

  it("checks the imported records' identifiers after applying", async () => {
    const { ends: e } = ends();

    await runImport({ ends: e, apply: true });

    expect(checkedIds(e)).toEqual({
      accounts: [OWNER],
      builds: [BUILD, BUILD_2],
      panels: ["p1"],
      defaultPanels: ["d1"],
      photoPaths: [`${BUILD}/TrussRod/1_a.jpg`, `${BUILD_2}/TrussRod/3_c.jpg`],
    });
  });

  it("reports a failed panel batch and leaves its panels out of the check", async () => {
    const { ends: e } = ends({
      failExecute: (sql) => sql.includes("insert into public.wood_panels"),
    });

    const result = await runImport({ ends: e, apply: true });

    expect(result.failures).toEqual([
      { kind: "panels", id: "p1", name: "", error: "boom public.wood_panels" },
    ]);
    expect(checkedIds(e)).toMatchObject({ panels: [], defaultPanels: ["d1"] });
  });

  it("reports failed default panels and leaves them out of the check", async () => {
    const { ends: e } = ends({
      failExecute: (sql) => sql.includes("insert into public.default_wood_panels"),
    });

    const result = await runImport({ ends: e, apply: true });

    expect(result.failures).toEqual([
      { kind: "default-panels", id: "d1", name: "", error: "boom public.default_wood_panels" },
    ]);
    expect(checkedIds(e)).toMatchObject({ panels: ["p1"], defaultPanels: [] });
  });

  it("names every panel of a failed batch", async () => {
    const two = [{ row: panel("p1", OWNER) }, { row: panel("p2", OWNER) }];
    const { ends: e } = ends({
      legacy: { "from public.wood_panels": two },
      failExecute: (sql) => sql.includes("insert into public.wood_panels"),
    });

    const result = await runImport({ ends: e, apply: true });

    expect(result.failures[0]?.id).toBe("p1, p2");
    expect(checkedIds(e)).toMatchObject({ panels: [] });
  });

  it("writes no default panels when there are none", async () => {
    const { ends: e } = ends({ legacy: { "from public.default_wood_panels": [] } });

    await runImport({ ends: e, apply: true });

    expect(executesOf(e).some((sql) => sql.includes("default_wood_panels"))).toBe(false);
  });

  it("leaves a build that failed after copying photos out of the check", async () => {
    const { ends: e } = ends({
      failExecute: (sql) => sql.includes("insert into public.builds") && sql.includes(BUILD_2),
    });

    const result = await runImport({ ends: e, apply: true });

    expect(result.failures.map((failure) => failure.id)).toEqual([BUILD_2]);
    expect(checkedIds(e)).toMatchObject({
      builds: [BUILD],
      photoPaths: [`${BUILD}/TrussRod/1_a.jpg`],
    });
    expect(result.photos.copied).toBe(1);
  });
});
