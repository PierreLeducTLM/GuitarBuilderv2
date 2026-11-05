import { describe, expect, it } from "vitest";
import { partFlow } from "./flow";
import { TEMPLATE_GROUPS } from "./groups";
import { type BuildVariant, displayGraph } from "./variant";

const VARIANTS: readonly BuildVariant[] = [
  { guitarType: "classical", boboNeck: true },
  { guitarType: "classical", boboNeck: false },
  { guitarType: "steel_string", boboNeck: true },
  { guitarType: "steel_string", boboNeck: false },
  { guitarType: null, boboNeck: true },
  { guitarType: null, boboNeck: false },
];

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const steelBobo = displayGraph({ guitarType: "steel_string", boboNeck: true });
const rowKeys = (flow: ReturnType<typeof partFlow>) =>
  flow.rows.map((row) => row.map((step) => step.key));

describe("partFlow", () => {
  it("lays the truss rod out top to bottom, with the nut and stop block side by side", () => {
    expect(rowKeys(partFlow(steelPlain, 1))).toEqual([
      ["TrussRod"],
      ["MakeTrussNut", "MakeTrussBlock"],
      ["CutBendRod"],
      ["ThreadRod"],
      ["AssembleParts"],
      ["BindRod"],
    ]);
  });

  it("puts three end-block steps in one row, and never more than three anywhere", () => {
    expect(Math.max(...partFlow(steelPlain, 8).rows.map((row) => row.length))).toBe(3);
    for (const variant of VARIANTS) {
      const graph = displayGraph(variant);
      for (const group of TEMPLATE_GROUPS) {
        expect(
          Math.max(...partFlow(graph, group.id).rows.map((row) => row.length)),
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it("places each step below all of its predecessors from the same group", () => {
    for (const variant of VARIANTS) {
      const graph = displayGraph(variant);
      for (const group of TEMPLATE_GROUPS) {
        for (const edge of partFlow(graph, group.id).edges) {
          expect(edge.to.row).toBeGreaterThan(edge.from.row);
        }
      }
    }
  });

  it("gives each connector the row and column of both ends", () => {
    expect(partFlow(steelPlain, 1).edges.slice(0, 3)).toEqual([
      {
        from: { key: "TrussRod", row: 0, column: 0 },
        to: { key: "MakeTrussNut", row: 1, column: 0 },
        skips: false,
      },
      {
        from: { key: "TrussRod", row: 0, column: 0 },
        to: { key: "MakeTrussBlock", row: 1, column: 1 },
        skips: false,
      },
      {
        from: { key: "MakeTrussNut", row: 1, column: 0 },
        to: { key: "CutBendRod", row: 2, column: 0 },
        skips: false,
      },
    ]);
  });

  it("flags the body-finish connector that skips a row", () => {
    const skipping = partFlow(steelBobo, 12).edges.filter((edge) => edge.skips);
    expect(skipping.map((edge) => [edge.from.key, edge.to.key])).toEqual([
      ["BOBOGlueLosen", "SandGrainBody"],
    ]);
  });

  it("leads from the truss rod to neck assembly", () => {
    const flow = partFlow(steelPlain, 1);
    expect(flow.entries).toEqual([]);
    expect(flow.exits.map((link) => [link.step, link.other, link.otherGroup.key])).toEqual([
      ["BindRod", "AssembleNeckRod", "neck-assembly"],
    ]);
  });

  it("comes into neck assembly from the truss rod, the fretboard and the neck", () => {
    const flow = partFlow(steelPlain, 11);
    expect(flow.entries.map((link) => [link.other, link.otherGroup.key, link.step])).toEqual([
      ["BindRod", "truss-rod", "AssembleNeckRod"],
      ["PressFrets", "fretboard", "AssembleNeckRod"],
      ["TaperThinHead", "neck", "AssembleNeckRod"],
    ]);
  });

  it.each(VARIANTS)(
    "shows every arrow once, inside a part or as an exit with its entry (%o)",
    (variant) => {
      const graph = displayGraph(variant);
      const flows = TEMPLATE_GROUPS.map((group) => partFlow(graph, group.id));
      const inside = flows.flatMap((flow) =>
        flow.edges.map((edge) => `${edge.from.key}>${edge.to.key}`),
      );
      const exits = flows.flatMap((flow) => flow.exits.map((link) => `${link.step}>${link.other}`));
      const entries = flows.flatMap((flow) =>
        flow.entries.map((link) => `${link.other}>${link.step}`),
      );
      const arrows = graph.arrows.map(([from, to]) => `${from}>${to}`);
      expect([...inside, ...exits].sort()).toEqual([...arrows].sort());
      expect([...entries].sort()).toEqual([...exits].sort());
    },
  );

  it("shows every displayed step of the group once", () => {
    for (const variant of VARIANTS) {
      const graph = displayGraph(variant);
      const shown = TEMPLATE_GROUPS.flatMap((group) => partFlow(graph, group.id).rows.flat());
      expect(shown.map((step) => step.key).sort()).toEqual(
        graph.steps.map((step) => step.key).sort(),
      );
    }
  });

  it("keeps template order within a row", () => {
    const flow = partFlow(displayGraph({ guitarType: null, boboNeck: true }), 8);
    for (const row of flow.rows) {
      expect(row.map((step) => step.number)).toEqual(
        [...row.map((step) => step.number)].sort((a, b) => a - b),
      );
    }
  });
});
