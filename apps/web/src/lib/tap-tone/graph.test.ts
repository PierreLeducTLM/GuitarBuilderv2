import { describe, expect, it } from "vitest";
import {
  frequencyAtX,
  GRAPH,
  levelY,
  nearestPeakIndex,
  snapTargetIndex,
  spreadLabels,
  tracePath,
  xOfFrequency,
} from "./graph";

const peaksAt = (...frequencies: number[]) =>
  frequencies.map((frequency, i) => ({ index: i, frequency, level: -20 - i, magnitude: 0.1 }));

describe("spectrum graph geometry", () => {
  it("maps 30-600 Hz linearly across the plot and clamps outside it", () => {
    expect(xOfFrequency(30)).toBe(GRAPH.left);
    expect(xOfFrequency(600)).toBe(GRAPH.left + GRAPH.plotWidth);
    expect(xOfFrequency(1000)).toBe(GRAPH.left + GRAPH.plotWidth);
    expect(xOfFrequency(315)).toBeCloseTo(GRAPH.left + GRAPH.plotWidth / 2, 9);
    expect(frequencyAtX(xOfFrequency(410))).toBeCloseTo(410, 9);
    expect(frequencyAtX(0)).toBe(30);
    expect(frequencyAtX(GRAPH.width)).toBe(600);
  });

  it("maps -100 to 0 dB from the bottom to the top and clamps levels outside it", () => {
    expect(levelY(0)).toBe(GRAPH.top);
    expect(levelY(-100)).toBe(GRAPH.top + GRAPH.plotHeight);
    expect(levelY(-50)).toBeCloseTo(GRAPH.top + GRAPH.plotHeight / 2, 9);
    expect(levelY(-120)).toBe(GRAPH.top + GRAPH.plotHeight);
    expect(levelY(3)).toBe(GRAPH.top);
  });

  it("draws the trace through every point on the axis in order", () => {
    const path = tracePath([
      { frequency: 30, magnitude: 1, db: 0 },
      { frequency: 600, magnitude: 0, db: -120 },
      { frequency: 600.1, magnitude: 0, db: -20 },
      { frequency: 1000, magnitude: 0, db: -40 },
    ]);
    expect(path).toBe(
      `${GRAPH.left.toFixed(1)},${GRAPH.top.toFixed(1)} ${(GRAPH.left + GRAPH.plotWidth).toFixed(1)},${(GRAPH.top + GRAPH.plotHeight).toFixed(1)}`,
    );
  });
});

describe("peak picking on the graph", () => {
  it("snaps to the nearest peak within 20 Hz of the pointer", () => {
    const peaks = peaksAt(181.8, 410.2);
    expect(snapTargetIndex(peaks, 175)).toBe(0);
    expect(snapTargetIndex(peaks, 161.8)).toBe(0);
    expect(snapTargetIndex(peaks, 161.7)).toBeNull();
    expect(snapTargetIndex(peaks, 600)).toBeNull();
    expect(snapTargetIndex([], 175)).toBeNull();
  });

  it("selects the closest detected peak wherever a click lands", () => {
    const peaks = peaksAt(181.8, 410.2);
    expect(nearestPeakIndex(peaks, 300)).toBe(1);
    expect(nearestPeakIndex(peaks, 290)).toBe(0);
    expect(nearestPeakIndex([], 300)).toBeNull();
  });

  it("ignores peaks beyond the frequency axis", () => {
    const peaks = peaksAt(720.4, 410.2);
    expect(nearestPeakIndex(peaks, 600)).toBe(1);
    expect(nearestPeakIndex(peaksAt(720.4), 600)).toBeNull();
    expect(snapTargetIndex(peaksAt(610), 600)).toBeNull();
  });
});

describe("spreadLabels", () => {
  const spread = (centers: readonly number[], bounds = { min: 0, max: 640 }) =>
    spreadLabels({ centers, width: 50, gap: 6, ...bounds });

  it("keeps labels that do not touch centred on their peaks", () => {
    expect(spread([100, 300])).toEqual([100, 300]);
    expect(spread([100, 156])).toEqual([100, 156]);
    expect(spread([100, 160])).toEqual([100, 160]);
  });

  it("centres touching labels on the mean of their peaks, a gap apart", () => {
    const [left, right] = spread([100, 155.9]);
    expect(left).toBeCloseTo(127.95 - 28, 6);
    expect(right).toBeCloseTo(127.95 + 28, 6);
    expect(spread([100, 120])).toEqual([82, 138]);
  });

  it("returns the labels in the order they were given", () => {
    expect(spread([300, 100])).toEqual([300, 100]);
    expect(spread([120, 100])).toEqual([138, 82]);
  });

  it("spreads three close body modes on a phone inside the plot", () => {
    const placed = spreadLabels({
      centers: [71.2, 118.0, 137.1],
      width: 78,
      gap: 6,
      min: 30,
      max: 350,
    });
    expect(placed).toEqual([69, 153, 237]);
  });

  it("shifts labels inside either edge of the plot", () => {
    expect(spread([630])).toEqual([615]);
    expect(spread([5])).toEqual([25]);
    expect(spread([630, 635])).toEqual([559, 615]);
    expect(spread([2, 8])).toEqual([25, 81]);
  });

  it("merges again when a merged group reaches its neighbour", () => {
    const placed = spread([100, 140, 200]);
    const mean = (100 + 140 + 200) / 3;
    expect(placed[0]).toBeCloseTo(mean - 56, 6);
    expect(placed[1]).toBeCloseTo(mean, 6);
    expect(placed[2]).toBeCloseTo(mean + 56, 6);
  });

  it("places nothing without labels", () => {
    expect(spread([])).toEqual([]);
  });
});
