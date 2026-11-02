import { describe, expect, it } from "vitest";
import { BOX_GAP, LAYER_GAP, layoutDiagram, STEP_BOX_HEIGHT, STEP_BOX_WIDTH } from "./layout";
import { displayGraph } from "./variant";

const graph = displayGraph({ guitarType: "steel_string", boboNeck: true });
const positions = layoutDiagram(graph);

describe("automatic layered layout", () => {
  it("places every displayed step", () => {
    expect(positions.size).toBe(120);
  });

  it("places each step to the right of all of its predecessors", () => {
    for (const [from, to] of graph.arrows) {
      expect((positions.get(to)?.x ?? 0) - (positions.get(from)?.x ?? 0)).toBeGreaterThanOrEqual(
        STEP_BOX_WIDTH + LAYER_GAP,
      );
    }
    const x = (key: string) => positions.get(key as never)?.x ?? Number.NaN;
    expect(x("TrussRod")).toBeLessThan(x("MakeTrussNut"));
    expect(x("MakeTrussNut")).toBeLessThan(x("CutBendRod"));
  });

  it("stacks parallel steps in the same layer, at least a box gap apart", () => {
    const nut = positions.get("MakeTrussNut");
    const block = positions.get("MakeTrussBlock");
    expect(nut?.x).toBe(block?.x);
    expect(Math.abs((nut?.y ?? 0) - (block?.y ?? 0))).toBeGreaterThanOrEqual(
      STEP_BOX_HEIGHT + BOX_GAP,
    );
  });

  it("puts layers 100 px apart", () => {
    const layers = [...new Set([...positions.values()].map((p) => p.x))].sort((a, b) => a - b);
    for (let i = 1; i < layers.length; i++) {
      expect((layers[i] as number) - (layers[i - 1] as number)).toBe(STEP_BOX_WIDTH + LAYER_GAP);
    }
  });
});
