import { describe, expect, it } from "vitest";
import { partFlow } from "./flow";
import { connectorPath, flowHeight, GUTTER_X, ROW_GAP, ROW_HEIGHT } from "./flowGeometry";
import { displayGraph } from "./variant";

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const steelBobo = displayGraph({ guitarType: "steel_string", boboNeck: true });

describe("flow geometry", () => {
  it("makes a flow as tall as its rows and the gaps between them", () => {
    expect(flowHeight(1)).toBe(ROW_HEIGHT);
    expect(flowHeight(3)).toBe(3 * ROW_HEIGHT + 2 * ROW_GAP);
    expect(flowHeight(0)).toBe(0);
  });

  it("draws a connector down from a box, across at mid-gap, and down into the next box", () => {
    const flow = partFlow(steelPlain, 1);
    const widths = flow.rows.map((row) => row.length);
    const [nut, block] = flow.edges;
    // Truss rod (one box) to the nut (left of two) and the stop block (right of two).
    expect(nut && connectorPath(nut, widths)).toBe("M 46 64 V 78 H 23 V 92");
    expect(block && connectorPath(block, widths)).toBe("M 46 64 V 78 H 69 V 92");
  });

  it("routes a connector that skips a row through the right-hand gutter", () => {
    const flow = partFlow(steelBobo, 12);
    const widths = flow.rows.map((row) => row.length);
    const skip = flow.edges.find((edge) => edge.skips);
    const top = (row: number) => row * (ROW_HEIGHT + ROW_GAP);
    expect(skip && connectorPath(skip, widths)).toBe(
      `M 46 ${top(2) + ROW_HEIGHT} V ${top(2) + ROW_HEIGHT + ROW_GAP / 2} H ${GUTTER_X} V ${top(4) - ROW_GAP / 2} H 46 V ${top(4)}`,
    );
  });
});
