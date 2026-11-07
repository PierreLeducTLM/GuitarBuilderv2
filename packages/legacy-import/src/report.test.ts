import { describe, expect, it } from "vitest";
import { planImport } from "./plan.ts";
import {
  reportFileBase,
  reportJson,
  reportMarkdown,
  summarize,
  terminalSummary,
} from "./report.ts";
import { type RunResult, runImport } from "./run.ts";
import { BUILD, CONFLICT_BUILD, ends, OWNER } from "./test-support/fake-ends.ts";

const meta = {
  startedAt: new Date("2026-11-06T18:45:07.123Z"),
  sourceProject: "legacyref",
  targetProject: "targetref",
};

const dryRun = () => runImport({ ends: ends().ends, apply: false });
const applied = () => runImport({ ends: ends().ends, apply: true });

describe("reportFileBase", () => {
  it("names the report by UTC time and mode", () => {
    expect(reportFileBase(meta, false)).toBe("20261106T184507Z-dry-run");
    expect(reportFileBase(meta, true)).toBe("20261106T184507Z-apply");
  });
});

describe("summarize", () => {
  it("counts what is imported, updated and skipped per kind", async () => {
    expect(summarize(await dryRun())).toEqual({
      accounts: { imported: 1, updated: 0, skipped: 1, givenProfile: 0, admins: 1 },
      builds: { imported: 2, updated: 0, skipped: 1, typeNotSet: 2, dimensionsDropped: 0 },
      panels: { imported: 1, updated: 0, skipped: 1, changed: 1 },
      defaultPanels: { imported: 1, updated: 0, skipped: 0, changed: 1 },
      photos: { toCopy: 3, copied: 0, missing: 1, orphaned: 0 },
      spectra: { reduced: 0, refused: 0 },
      failures: 0,
    });
  });

  it("counts copied photos after applying", async () => {
    expect(summarize(await applied()).photos).toEqual({
      toCopy: 3,
      copied: 2,
      missing: 1,
      orphaned: 0,
    });
  });
});

describe("reportMarkdown", () => {
  it("lists everything the owner reviews in a dry run", async () => {
    expect(reportMarkdown(await dryRun(), meta)).toMatchSnapshot();
  });

  it("adds the post-apply check after applying", async () => {
    const markdown = reportMarkdown(await applied(), meta);

    expect(markdown).toContain("## Post-apply check");
    expect(markdown).toMatchSnapshot();
  });

  it("names the skipped account's email and its skipped builds", async () => {
    const markdown = reportMarkdown(await dryRun(), meta);

    expect(markdown).toContain("taken@example.com");
    expect(markdown).toContain(CONFLICT_BUILD);
  });
});

describe("reportJson", () => {
  it("holds the plan, outcomes and summary as plain data", async () => {
    const json = reportJson(await applied(), meta);
    const roundTrip = JSON.parse(JSON.stringify(json));

    expect(roundTrip).toMatchObject({
      mode: "apply",
      startedAt: "2026-11-06T18:45:07.123Z",
      sourceProject: "legacyref",
      targetProject: "targetref",
      summary: { accounts: { imported: 1 } },
      verification: { accounts: 1 },
    });
    expect(roundTrip.plan.builds.map((build: { id: string }) => build.id)).toContain(BUILD);
    expect(roundTrip.plan.existing.buildIds).toEqual([]);
  });

  it("leaves out password hashes and Auth rows", async () => {
    const text = JSON.stringify(reportJson(await dryRun(), meta));

    expect(text).not.toContain("encrypted_password");
    expect(text).not.toContain('"user":');
  });
});

describe("terminalSummary", () => {
  it("shows counts and the report's location, and no email address", async () => {
    const summary = terminalSummary(await dryRun(), {
      markdown: "reports/legacy-import/x.md",
      json: "reports/legacy-import/x.json",
    });

    expect(summary).not.toMatch(/@/);
    expect(summary).not.toContain(OWNER);
    expect(summary).toMatchSnapshot();
  });
});

describe("a report with every kind of note", () => {
  const OWNER_2 = "a0000000-0000-4000-8000-00000000000a";
  const spectrum = (count: number) => ({
    frequencies: Array.from({ length: count }, (_, i) => 20 + i * 0.5),
    magnitudes: Array.from({ length: count }, () => 0.001),
    magnitudesDb: Array.from({ length: count }, () => -60),
    sampleRate: 16384,
    fftSize: 32768,
    binWidth: 0.5,
  });
  const panelRow = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    user_id: OWNER,
    build_id: null,
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
    estimated_panel_mass: null,
    ...overrides,
  });
  const analysis = (overrides: Record<string, unknown>) => ({
    id: "m1",
    timestamp: 1,
    description: "Top",
    peakFrequency: 182.5,
    fftData: spectrum(3),
    ...overrides,
  });

  const rich = (): RunResult => {
    const plan = planImport(
      {
        users: [
          { id: OWNER, email: "owner@example.com", legacy_only: 1 },
          { id: OWNER_2, email: null },
        ],
        identities: [],
        profiles: [{ id: OWNER, role: "user" }],
        builds: [
          {
            id: BUILD,
            user_id: OWNER,
            text_identifier: "  ",
            model_name: "OM",
            width: 380,
            length: 495,
            sequence_diagram: {
              nodes: [
                {
                  id: "FabricateCLBridge",
                  completed: true,
                  photos: [{ fileName: "lost.jpg" }],
                  fftAnalyses: [
                    analysis({ peakFrequency: null }),
                    analysis({ id: "m2", fftData: spectrum(1366) }),
                    analysis({ id: "" }),
                  ],
                },
                { id: "FabricateCLBridge", notes: "again" },
                { id: 7, completed: true },
              ],
            },
          },
          { id: "orphan-build", user_id: null, text_identifier: "No owner" },
        ],
        panels: [
          panelRow("p1", {
            name: " ",
            build_id: BUILD,
            fft_data: {
              freqLongitudinal: spectrum(2048),
              freqCrossGrain: { ...spectrum(3), magnitudes: [1] },
              freqTwist: spectrum(3),
            },
          }),
          panelRow("p2", { sample_mass: 0 }),
        ],
        defaultPanels: [panelRow("d1", { name: "Ref | A\nB" })],
        photoObjects: ["x/y/z.jpg"],
        mfaFactors: 2,
        tableCounts: [
          { table: "public.fft_results", rows: 35 },
          { table: "public.posted_steps", rows: null },
        ],
      },
      {
        columns: {
          users: { writable: ["id", "email"], generated: [] },
          identities: { writable: ["id"], generated: [] },
        },
        accounts: [{ id: OWNER, email: "owner@example.com" }],
        buildIds: new Set([BUILD]),
        panelIds: new Set(["p1"]),
        defaultPanelIds: new Set(["d1"]),
      },
    );
    return {
      apply: true,
      plan,
      photos: {
        copied: 4,
        missing: [{ build: BUILD, step: "FabricateCLBridge", path: `${BUILD}/x/gone.jpg` }],
      },
      panelChanges: [
        {
          table: "default_wood_panels",
          id: "d1",
          name: "Ref | A\nB",
          old: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: null },
          new: { eCrossGpa: 0.5667, targetThicknessMm: 0.9587, estimatedMassG: 31.39 },
        },
      ],
      failures: [
        { kind: "build", id: BUILD, name: "Untitled build", error: "Upload failed (500)" },
        { kind: "panels", id: "p1", name: "", error: "boom" },
      ],
      verification: { accounts: 2, builds: 0 },
    };
  };

  it("counts every kind of note", () => {
    expect(summarize(rich())).toEqual({
      accounts: { imported: 2, updated: 1, skipped: 0, givenProfile: 1, admins: 0 },
      builds: { imported: 1, updated: 1, skipped: 1, typeNotSet: 0, dimensionsDropped: 1 },
      panels: { imported: 1, updated: 1, skipped: 1, changed: 0 },
      defaultPanels: { imported: 1, updated: 1, skipped: 0, changed: 1 },
      photos: { toCopy: 0, copied: 4, missing: 1, orphaned: 1 },
      spectra: { reduced: 2, refused: 3 },
      failures: 2,
    });
  });

  it("describes every note for the owner", () => {
    expect(reportMarkdown(rich(), meta)).toMatchSnapshot();
  });

  it("counts every note in the terminal", () => {
    expect(terminalSummary(rich(), { markdown: "r.md", json: "r.json" })).toMatchSnapshot();
  });

  it("keeps the dropped Auth columns and existing records in the JSON", () => {
    const json = JSON.parse(JSON.stringify(reportJson(rich(), meta)));

    expect(json.plan.accounts[0]).toEqual({
      kind: "import",
      id: OWNER,
      email: "owner@example.com",
      role: "user",
      givenProfile: false,
      droppedColumns: ["auth.users.legacy_only"],
    });
    expect(json.plan.builds[0]).toMatchObject({
      ownerId: OWNER,
      guitarType: "classical",
      shared: false,
      steps: [{ key: "FabricateCLBridge", photos: 0, measurements: 1 }],
    });
    expect(json.plan.panels[0]).toMatchObject({
      legacyResults: { eCrossGpa: 0.28, targetThicknessMm: 2.9, estimatedMassG: null },
    });
    expect(json.plan).toMatchObject({
      orphanPhotos: 1,
      mfaFactors: 2,
      existing: {
        accountIds: [OWNER],
        buildIds: [BUILD],
        panelIds: ["p1"],
        defaultPanelIds: ["d1"],
      },
    });
    expect(json.plan.panels[0]).not.toHaveProperty("row");
  });
});

describe("skipped accounts in the report", () => {
  const TAKEN = "c0000000-0000-4000-8000-00000000000c";
  const ALSO_TAKEN = "d0000000-0000-4000-8000-00000000000d";
  const result = (): RunResult => ({
    apply: false,
    plan: planImport(
      {
        users: [
          { id: TAKEN, email: "taken@example.com" },
          { id: ALSO_TAKEN, email: "also@example.com" },
        ],
        identities: [],
        profiles: [],
        builds: [{ id: "b-taken", user_id: TAKEN, text_identifier: "Dread" }],
        panels: [
          {
            id: "p-taken",
            user_id: TAKEN,
            name: "Sitka",
            sample_length: 1,
            sample_width: 1,
            sample_thickness: 1,
            sample_mass: 1,
            freq_longitudinal: 1,
            freq_cross_grain: 1,
            freq_diagonal: 1,
            target_plate_length: 1,
            target_plate_width: 1,
            vibrational_stiffness_param: 1,
          },
        ],
        defaultPanels: [],
        photoObjects: [],
        mfaFactors: 0,
        tableCounts: [],
      },
      {
        columns: {
          users: { writable: ["id", "email"], generated: [] },
          identities: { writable: [], generated: [] },
        },
        accounts: [
          { id: "v1", email: "taken@example.com" },
          { id: "v2", email: "also@example.com" },
        ],
        buildIds: new Set(),
        panelIds: new Set(),
        defaultPanelIds: new Set(),
      },
    ),
    photos: { copied: 0, missing: [] },
    panelChanges: [],
    failures: [],
    verification: null,
  });

  it("lists each skipped account with only the records it owns", () => {
    const markdown = reportMarkdown(result(), meta);

    expect(markdown).toContain(
      `- taken@example.com (${TAKEN}): email already used by another account; skipped with it: build "Dread" (b-taken), wood panel "Sitka" (p-taken)\n`,
    );
    expect(markdown).toContain(
      `- also@example.com (${ALSO_TAKEN}): email already used by another account\n`,
    );
  });

  it("keeps the skipped records whole in the JSON", () => {
    const json = JSON.parse(JSON.stringify(reportJson(result(), meta)));

    expect(json.plan.accounts[0]).toEqual({
      kind: "skip",
      id: TAKEN,
      email: "taken@example.com",
      reason: "email already used by another account",
    });
    expect(json.plan.panels[0]).toEqual({
      kind: "skip",
      id: "p-taken",
      name: "Sitka",
      ownerId: TAKEN,
      reason: "email already used by another account",
    });
  });
});
