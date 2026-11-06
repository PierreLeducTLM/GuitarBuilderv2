import { describe, expect, it, vi } from "vitest";
import { LATER_TABLES, NEVER_TABLES, readLegacy, readTarget, readV2PanelResults } from "./read.ts";
import { type Row, readOnly, type SqlExecutor } from "./transport/sql.ts";

/** A fake executor answering each query by the first fixture whose key the SQL contains. */
const fakeExecutor = (fixtures: Readonly<Record<string, readonly Row[]>>) => {
  const query = vi.fn(async (sql: string) => {
    const key = Object.keys(fixtures).find((candidate) => sql.includes(candidate));
    if (key === undefined) throw new Error(`unexpected query: ${sql}`);
    return fixtures[key] ?? [];
  });
  const executor: SqlExecutor = { query, execute: vi.fn(async () => undefined) };
  return { executor, query };
};

const legacyFixtures = {
  "from auth.users": [
    { row: { id: "u1", email: "a@example.com" } },
    { row: null },
    { row: "not a row" },
  ],
  "from auth.identities": [{ row: { id: "i1", user_id: "u1" } }],
  "from public.user_profiles": [{ id: "u1", role: "admin" }],
  "from public.guitar_builds": [{ row: { id: "b1" } }],
  "from public.wood_panels": [{ row: { id: "p1" } }],
  "from public.default_wood_panels": [{ row: { id: "d1" } }],
  "from storage.objects": [{ name: "b1/TrussRod/1_a.jpg" }, { name: "b9/x/2_b.jpg" }],
  "from auth.mfa_factors": [{ count: 2 }],
  query_to_xml: [
    { name: "public.fft_results", rows: 35 },
    { name: "public.instagram_accounts", rows: null },
    { name: "public.settings", rows: "12" },
  ],
};

describe("readLegacy", () => {
  it("reads every record the import needs from the first-version project", async () => {
    const { executor } = fakeExecutor(legacyFixtures);

    await expect(readLegacy(executor)).resolves.toEqual({
      users: [{ id: "u1", email: "a@example.com" }],
      identities: [{ id: "i1", user_id: "u1" }],
      profiles: [{ id: "u1", role: "admin" }],
      builds: [{ id: "b1" }],
      panels: [{ id: "p1" }],
      defaultPanels: [{ id: "d1" }],
      photoObjects: ["b1/TrussRod/1_a.jpg", "b9/x/2_b.jpg"],
      mfaFactors: 2,
      tableCounts: [
        { table: "public.fft_results", rows: 35 },
        { table: "public.instagram_accounts", rows: null },
        { table: "public.settings", rows: null },
      ],
    });
  });

  it("passes the first-version project's select-only guard with every query", async () => {
    const { executor, query } = fakeExecutor(legacyFixtures);

    await readLegacy(readOnly(executor));

    expect(query).toHaveBeenCalledTimes(9);
  });

  it("reads whole rows in a stable order", async () => {
    const { executor, query } = fakeExecutor(legacyFixtures);

    await readLegacy(executor);

    const sql = query.mock.calls.map(([statement]) => statement);
    expect(sql).toContain(
      "select to_jsonb(t) as row from auth.users t order by t.created_at, t.id",
    );
    expect(sql).toContain(
      "select to_jsonb(t) as row from public.guitar_builds t order by t.created_at, t.id",
    );
    expect(sql).toContain(
      "select name from storage.objects where bucket_id = 'step-photos' order by name",
    );
  });

  it("counts the tables not imported yet and the Instagram tables, missing ones as null", async () => {
    const { executor, query } = fakeExecutor(legacyFixtures);

    await readLegacy(executor);

    const countQuery = query.mock.calls
      .map(([statement]) => statement)
      .find((statement) => statement.includes("query_to_xml"));
    expect(countQuery).toBe(
      `select t.name, case when to_regclass(t.name) is null then null else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', t.name), false, true, '')))[1]::text::int end as rows from (values ${[...LATER_TABLES, ...NEVER_TABLES].map((table) => `('${table}')`).join(", ")}) as t(name)`,
    );
    expect(countQuery).toContain("('public.fft_results'), ('public.settings')");
  });

  it("reads an empty MFA answer as zero", async () => {
    const { executor } = fakeExecutor({ ...legacyFixtures, "from auth.mfa_factors": [] });

    await expect(readLegacy(executor)).resolves.toMatchObject({ mfaFactors: 0 });
  });

  it("reads a count that is not a number as zero", async () => {
    const { executor } = fakeExecutor({ ...legacyFixtures, "from auth.mfa_factors": [{}] });

    await expect(readLegacy(executor)).resolves.toMatchObject({ mfaFactors: 0 });
  });
});

describe("readTarget", () => {
  const targetFixtures = {
    "from information_schema.columns": [
      { table_name: "users", column_name: "id", is_generated: "NEVER" },
      { table_name: "users", column_name: "confirmed_at", is_generated: "ALWAYS" },
      { table_name: "identities", column_name: "provider", is_generated: "NEVER" },
      { table_name: "identities", column_name: "email", is_generated: "ALWAYS" },
    ],
    "select id, email from auth.users": [
      { id: "v1", email: "owner@example.com" },
      { id: "v2", email: null },
      { id: "v3", email: 5 },
    ],
    "select id from public.builds": [{ id: "b1" }],
    "select id from public.wood_panels": [{ id: "p1" }],
    "select id from public.default_wood_panels": [{ id: "d1" }],
  };

  it("reads the Auth column lists, existing accounts and existing records", async () => {
    const { executor } = fakeExecutor(targetFixtures);

    await expect(readTarget(executor)).resolves.toEqual({
      columns: {
        users: { writable: ["id"], generated: ["confirmed_at"] },
        identities: { writable: ["provider"], generated: ["email"] },
      },
      accounts: [
        { id: "v1", email: "owner@example.com" },
        { id: "v2", email: null },
        { id: "v3", email: null },
      ],
      buildIds: new Set(["b1"]),
      panelIds: new Set(["p1"]),
      defaultPanelIds: new Set(["d1"]),
    });
  });

  it("reads the columns of auth.users and auth.identities only", async () => {
    const { executor, query } = fakeExecutor(targetFixtures);

    await readTarget(executor);

    expect(query.mock.calls.map(([sql]) => sql)).toContain(
      "select table_name, column_name, is_generated from information_schema.columns where table_schema = 'auth' and table_name in ('users', 'identities') order by ordinal_position",
    );
  });
});

describe("readV2PanelResults", () => {
  const inputs = {
    sample_length_mm: 602,
    sample_width_mm: 283,
    sample_thickness_mm: 3.8,
    sample_mass_g: 270,
    freq_longitudinal_hz: 140,
    freq_cross_grain_hz: 57,
    freq_diagonal_hz: 90,
    plate_length_mm: 520,
    plate_width_mm: 200,
    stiffness_parameter: 75,
  };

  it("asks v2's own formula functions for each panel's results", async () => {
    const { executor, query } = fakeExecutor({
      "public.wood_e_cross_gpa": [
        { id: "p1", e_cross_gpa: 0.57, target_thickness_mm: 2.75, estimated_mass_g: 141.2 },
      ],
    });

    const results = await readV2PanelResults(executor, [{ id: "p1", ...inputs }]);

    expect(results).toEqual(
      new Map([["p1", { eCrossGpa: 0.57, targetThicknessMm: 2.75, estimatedMassG: 141.2 }]]),
    );
    const sql = (query.mock.calls[0]?.[0] ?? "").replaceAll(/\$gb_[0-9a-f]+\$/g, "$tag$");
    const sample = "p.sample_length_mm, p.sample_width_mm, p.sample_thickness_mm, p.sample_mass_g";
    const all = `${sample}, p.freq_longitudinal_hz, p.freq_cross_grain_hz, p.freq_diagonal_hz, p.plate_length_mm, p.plate_width_mm, p.stiffness_parameter`;
    const columns = [
      "id text",
      ...Object.keys(inputs).map((column) => `${column} double precision`),
    ].join(", ");
    expect(sql).toBe(
      `select p.id, public.wood_e_cross_gpa(${sample}, p.freq_cross_grain_hz) as e_cross_gpa, public.wood_target_thickness_mm(${all}) as target_thickness_mm, public.wood_estimated_mass_g(${all}) as estimated_mass_g from jsonb_to_recordset($tag$${JSON.stringify([{ id: "p1", ...inputs }])}$tag$::jsonb) as p(${columns})`,
    );
  });

  it("asks nothing when there are no panels", async () => {
    const { executor, query } = fakeExecutor({});

    await expect(readV2PanelResults(executor, [])).resolves.toEqual(new Map());
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["E_C", { e_cross_gpa: null, target_thickness_mm: 1, estimated_mass_g: 1 }],
    ["the thickness", { e_cross_gpa: 1, target_thickness_mm: null, estimated_mass_g: 1 }],
    ["the mass", { e_cross_gpa: 1, target_thickness_mm: 1, estimated_mass_g: null }],
  ])("refuses an answer without %s", async (_label, values) => {
    const { executor } = fakeExecutor({ "public.wood_e_cross_gpa": [{ id: "p1", ...values }] });

    await expect(readV2PanelResults(executor, [{ id: "p1", ...inputs }])).rejects.toThrow(
      "v2 could not compute the results of panel p1",
    );
  });
});
