import { vi } from "vitest";
import type { Ends } from "../run.ts";
import type { Row, SqlExecutor } from "../transport/sql.ts";
import type { Download, SourceStorage, TargetStorage } from "../transport/storage.ts";

/** Fake first-version and v2 ends for run and report tests: fixtures answer SQL by substring. */

export const OWNER = "b0000000-0000-4000-8000-00000000000b";
export const CONFLICT = "c0000000-0000-4000-8000-00000000000c";
export const BUILD = "e0000000-0000-4000-8000-00000000000e";
export const BUILD_2 = "e0000000-0000-4000-8000-0000000000e2";
export const CONFLICT_BUILD = "e0000000-0000-4000-8000-0000000000ee";
export const LEGACY_URL = "https://legacy.supabase.co";

export const panel = (id: string, userId: string | null) => ({
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

export type EndsOptions = {
  failUploadFor?: string;
  failExecute?: (sql: string) => boolean;
  legacy?: Partial<typeof legacyFixtures>;
  target?: Partial<typeof targetFixtures>;
};

export const ends = (options: EndsOptions = {}) => {
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
