import { describe, expect, it } from "vitest";
import { type BuildOwners, convertBuild, finalStepState } from "./builds.ts";

const OWNER = "b0000000-0000-4000-8000-00000000000b";
const BUILD = "e0000000-0000-4000-8000-00000000000e";
const TOKEN = "70000000-0000-4000-8000-000000000007";

const legacyBuild = (overrides: Record<string, unknown> = {}) => ({
  id: BUILD,
  user_id: OWNER,
  text_identifier: "  OM #1 ",
  model_name: "",
  width: null,
  length: null,
  created_at: "2025-01-01T00:00:00+00:00",
  updated_at: "2025-03-01T12:00:00+00:00",
  share_token: null,
  share_enabled: false,
  sequence_diagram: { nodes: [{ id: "TrussRod", completed: true }] },
  ...overrides,
});

const owners = (overrides: Partial<BuildOwners> = {}): BuildOwners => ({
  imported: new Set([OWNER]),
  skipped: new Map(),
  ...overrides,
});

describe("convertBuild", () => {
  it("keeps the identifier, owner, trimmed name and times, with a BOBO neck", () => {
    const plan = convertBuild(legacyBuild(), owners());

    expect(plan).toMatchObject({
      kind: "import",
      id: BUILD,
      name: "OM #1",
      row: {
        id: BUILD,
        owner_id: OWNER,
        name: "OM #1",
        guitar_type: null,
        bobo_neck: true,
        share_enabled: false,
        share_token: null,
        created_at: "2025-01-01T00:00:00+00:00",
        updated_at: "2025-03-01T12:00:00+00:00",
      },
      steps: [
        {
          entry: { key: "TrussRod", completed: true, notes: "", photos: [], measurements: [] },
          photoSources: [],
        },
      ],
    });
  });

  it("drops the legacy model name, width and length, and reports them", () => {
    const plan = convertBuild(
      legacyBuild({ text_identifier: "OM #1", model_name: "OM", width: 380, length: 495 }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row).not.toHaveProperty("model_name");
    expect(plan.kind === "import" && plan.notes).toContainEqual({
      kind: "dimensions-dropped",
      modelName: "OM",
      width: 380,
      length: 495,
    });
  });

  it.each([
    ["a model name", { model_name: "Dread" }],
    ["a width", { width: 380 }],
    ["a length", { length: 0 }],
  ])("reports dimensions when only %s is set", (_label, overrides) => {
    const plan = convertBuild(legacyBuild(overrides), owners());

    expect(plan.kind === "import" && plan.notes.map((note) => note.kind)).toContain(
      "dimensions-dropped",
    );
  });

  it("does not report empty dimensions", () => {
    const plan = convertBuild(legacyBuild({ model_name: "  " }), owners());

    expect(plan.kind === "import" && plan.notes.map((note) => note.kind)).not.toContain(
      "dimensions-dropped",
    );
  });

  it("infers the guitar type from the steps with data", () => {
    const plan = convertBuild(
      legacyBuild({ sequence_diagram: { nodes: [{ id: "FabricateCLBridge", completed: true }] } }),
      owners(),
    );

    expect(plan.kind === "import" && plan.row.guitar_type).toBe("classical");
    expect(plan.kind === "import" && plan.notes.map((note) => note.kind)).not.toContain(
      "type-not-set",
    );
  });

  it("reports a build whose guitar type cannot be inferred", () => {
    const plan = convertBuild(legacyBuild(), owners());

    expect(plan.kind === "import" && plan.notes).toContainEqual({ kind: "type-not-set" });
  });

  it("names a build with a blank name Untitled build and reports it", () => {
    const plan = convertBuild(legacyBuild({ text_identifier: "   " }), owners());

    expect(plan).toMatchObject({ kind: "import", name: "Untitled build" });
    expect(plan.kind === "import" && plan.notes).toContainEqual({
      kind: "renamed",
      to: "Untitled build",
    });
  });

  it("keeps the share token of a shared build", () => {
    const plan = convertBuild(legacyBuild({ share_enabled: true, share_token: TOKEN }), owners());

    expect(plan.kind === "import" && plan.row).toMatchObject({
      share_enabled: true,
      share_token: TOKEN,
    });
  });

  it("drops a leftover token of an unshared build", () => {
    const plan = convertBuild(legacyBuild({ share_enabled: false, share_token: TOKEN }), owners());

    expect(plan.kind === "import" && plan.row).toMatchObject({
      share_enabled: false,
      share_token: null,
    });
  });

  it("reads a non-boolean sharing state as off", () => {
    const plan = convertBuild(legacyBuild({ share_enabled: "true", share_token: TOKEN }), owners());

    expect(plan.kind === "import" && plan.row).toMatchObject({
      share_enabled: false,
      share_token: null,
    });
  });

  it("lists each step's photo sources in order and reports photos without a path", () => {
    const plan = convertBuild(
      legacyBuild({
        sequence_diagram: {
          nodes: [
            {
              id: "TrussRod",
              photos: [
                { fileName: `${BUILD}/TrussRod/1_a.jpg` },
                { fileName: "lost.jpg" },
                { fileName: `${BUILD}/TrussRod/2_b.jpg` },
              ],
            },
          ],
        },
      }),
      owners(),
    );

    expect(plan.kind === "import" && plan.steps[0]?.photoSources).toEqual([
      `${BUILD}/TrussRod/1_a.jpg`,
      `${BUILD}/TrussRod/2_b.jpg`,
    ]);
    expect(plan.kind === "import" && plan.notes).toContainEqual({
      kind: "photo-without-path",
      step: "TrussRod",
    });
  });

  it("passes the step notes on", () => {
    const plan = convertBuild(
      legacyBuild({ sequence_diagram: { nodes: [{ id: 3, completed: true }] } }),
      owners(),
    );

    expect(plan.kind === "import" && plan.notes).toContainEqual({ kind: "step-without-key" });
  });

  it("reports nothing for a clean build", () => {
    const plan = convertBuild(
      legacyBuild({
        sequence_diagram: {
          nodes: [
            {
              id: "FabricateCLBridge",
              completed: true,
              photos: [{ fileName: `${BUILD}/FabricateCLBridge/1_a.jpg` }],
            },
          ],
        },
      }),
      owners(),
    );

    expect(plan.kind === "import" && plan.notes).toEqual([]);
  });

  it("reads a build whose dimension columns are missing as having none", () => {
    const { model_name: _m, width: _w, length: _l, ...withoutDimensions } = legacyBuild();

    const plan = convertBuild(withoutDimensions, owners());

    expect(plan.kind === "import" && plan.notes.map((note) => note.kind)).not.toContain(
      "dimensions-dropped",
    );
  });

  it("names a build whose name is not text Untitled build", () => {
    expect(convertBuild(legacyBuild({ text_identifier: 42 }), owners())).toMatchObject({
      kind: "import",
      name: "Untitled build",
    });
  });

  it("skips a build whose owner is not an identifier", () => {
    expect(convertBuild(legacyBuild({ user_id: 7 }), owners())).toMatchObject({
      kind: "skip",
      ownerId: null,
      reason: "no owner",
    });
  });

  it("skips a build without an owner", () => {
    expect(convertBuild(legacyBuild({ user_id: null }), owners())).toEqual({
      kind: "skip",
      id: BUILD,
      name: "OM #1",
      ownerId: null,
      reason: "no owner",
    });
  });

  it("skips a build whose owner was not imported", () => {
    expect(convertBuild(legacyBuild(), owners({ imported: new Set() }))).toMatchObject({
      kind: "skip",
      ownerId: OWNER,
      reason: "owner not imported",
    });
  });

  it("skips a build whose owner was skipped, with the owner's reason", () => {
    const skipped = new Map([[OWNER, "email already used by another account"]]);

    expect(convertBuild(legacyBuild(), owners({ imported: new Set(), skipped }))).toMatchObject({
      kind: "skip",
      ownerId: OWNER,
      reason: "email already used by another account",
    });
  });
});

describe("finalStepState", () => {
  it("fills each step's photos in order, leaving out photos that were not copied", () => {
    const plan = convertBuild(
      legacyBuild({
        sequence_diagram: {
          nodes: [
            {
              id: "TrussRod",
              completed: true,
              photos: [
                { fileName: `${BUILD}/TrussRod/1_a.jpg` },
                { fileName: `${BUILD}/TrussRod/2_b.jpg` },
                { fileName: `${BUILD}/TrussRod/3_c.jpg` },
              ],
            },
          ],
        },
      }),
      owners(),
    );
    if (plan.kind !== "import") throw new Error("expected an import");

    const state = finalStepState(plan.steps, (stepKey, sourcePath) =>
      sourcePath.endsWith("2_b.jpg")
        ? null
        : { url: `https://t/${stepKey}/${sourcePath.slice(-7)}`, name: sourcePath.slice(-7) },
    );

    expect(state).toEqual([
      {
        key: "TrussRod",
        completed: true,
        notes: "",
        measurements: [],
        photos: [
          { url: "https://t/TrussRod/1_a.jpg", name: "1_a.jpg" },
          { url: "https://t/TrussRod/3_c.jpg", name: "3_c.jpg" },
        ],
      },
    ]);
  });
});
