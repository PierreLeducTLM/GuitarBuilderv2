import { describe, expect, it, vi } from "vitest";
import { type Ends, runImport } from "./run.ts";
import {
  BUILD,
  BUILD_2,
  CONFLICT,
  CONFLICT_BUILD,
  ends,
  LEGACY_URL,
  OWNER,
  panel,
} from "./test-support/fake-ends.ts";

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
