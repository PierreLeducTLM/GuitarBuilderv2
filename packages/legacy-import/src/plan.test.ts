import { describe, expect, it } from "vitest";
import { planImport } from "./plan.ts";
import type { LegacySnapshot, TargetSnapshot } from "./read.ts";

const OWNER = "b0000000-0000-4000-8000-00000000000b";
const CONFLICT = "c0000000-0000-4000-8000-00000000000c";
const BUILD = "e0000000-0000-4000-8000-00000000000e";
const CONFLICT_BUILD = "e0000000-0000-4000-8000-0000000000ee";

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
});

const legacy = (overrides: Partial<LegacySnapshot> = {}): LegacySnapshot => ({
  users: [
    { id: OWNER, email: "owner@example.com" },
    { id: CONFLICT, email: "taken@example.com" },
  ],
  identities: [],
  profiles: [{ id: OWNER, role: "admin" }],
  builds: [
    {
      id: BUILD,
      user_id: OWNER,
      text_identifier: "OM",
      sequence_diagram: {
        nodes: [{ id: "TrussRod", photos: [{ fileName: `${BUILD}/TrussRod/1_a.jpg` }] }],
      },
    },
    { id: CONFLICT_BUILD, user_id: CONFLICT, text_identifier: "Dread" },
  ],
  panels: [panel("p1", OWNER), panel("p2", null), panel("p3", CONFLICT)],
  defaultPanels: [panel("d1", null)],
  photoObjects: [`${BUILD}/TrussRod/1_a.jpg`, `${BUILD}/Old/9_z.jpg`, "x/y/z.jpg"],
  mfaFactors: 1,
  tableCounts: [{ table: "public.fft_results", rows: 3 }],
  ...overrides,
});

const target = (overrides: Partial<TargetSnapshot> = {}): TargetSnapshot => ({
  columns: {
    users: { writable: ["id", "email"], generated: [] },
    identities: { writable: ["id"], generated: [] },
  },
  accounts: [{ id: "v2-account", email: "TAKEN@example.com" }],
  buildIds: new Set([BUILD]),
  panelIds: new Set(),
  defaultPanelIds: new Set(["d1"]),
  ...overrides,
});

describe("planImport", () => {
  it("plans accounts, skipping one whose email is taken", () => {
    const plan = planImport(legacy(), target());

    expect(plan.accounts.map((account) => [account.id, account.kind])).toEqual([
      [OWNER, "import"],
      [CONFLICT, "skip"],
    ]);
  });

  it("skips the builds and panels of a skipped account with its reason", () => {
    const plan = planImport(legacy(), target());

    expect(plan.builds.map((build) => [build.id, build.kind])).toEqual([
      [BUILD, "import"],
      [CONFLICT_BUILD, "skip"],
    ]);
    expect(plan.builds[1]).toMatchObject({ reason: "email already used by another account" });
    expect(plan.panels.map((p) => [p.id, p.kind, p.kind === "skip" ? p.reason : ""])).toEqual([
      ["p1", "import", ""],
      ["p2", "skip", "no owner"],
      ["p3", "skip", "email already used by another account"],
    ]);
  });

  it("plans the default panels", () => {
    expect(planImport(legacy(), target()).defaultPanels.map((p) => p.kind)).toEqual(["import"]);
  });

  it("counts photo files that no first-version build references", () => {
    expect(planImport(legacy(), target()).orphanPhotos).toBe(2);
  });

  it("counts files of skipped builds as referenced, not orphaned", () => {
    const withConflictPhoto = legacy({
      builds: [
        {
          id: CONFLICT_BUILD,
          user_id: CONFLICT,
          text_identifier: "Dread",
          sequence_diagram: { nodes: [{ id: "S", photos: [{ fileName: "x/y/z.jpg" }] }] },
        },
      ],
    });

    expect(planImport(withConflictPhoto, target()).orphanPhotos).toBe(2);
  });

  it("knows which records already exist in v2", () => {
    const plan = planImport(legacy(), target());

    expect(plan.existing.buildIds.has(BUILD)).toBe(true);
    expect(plan.existing.defaultPanelIds.has("d1")).toBe(true);
    expect(plan.existing.accountIds.has(OWNER)).toBe(false);
    expect(plan.existing.accountIds.has("v2-account")).toBe(true);
  });

  it("passes the counts of records not imported on", () => {
    expect(planImport(legacy(), target())).toMatchObject({
      mfaFactors: 1,
      tableCounts: [{ table: "public.fft_results", rows: 3 }],
    });
  });
});
