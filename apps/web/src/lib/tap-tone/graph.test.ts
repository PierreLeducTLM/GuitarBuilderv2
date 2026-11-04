import { describe, expect, it } from "vitest";
import {
  frequencyAtX,
  GRAPH,
  levelY,
  nearestPeakIndex,
  snapTargetIndex,
  tracePath,
  xOfFrequency,
} from "./graph";

const peaksAt = (...frequencies: number[]) =>
  frequencies.map((frequency, i) => ({ index: i, frequency, level: -20 - i, magnitude: 0.1 }));

describe("spectrum graph geometry", () => {
  it("maps 30-1000 Hz linearly across the plot and clamps outside it", () => {
    expect(xOfFrequency(30)).toBe(GRAPH.left);
    expect(xOfFrequency(1000)).toBe(GRAPH.left + GRAPH.plotWidth);
    expect(xOfFrequency(515)).toBeCloseTo(GRAPH.left + GRAPH.plotWidth / 2, 9);
    expect(frequencyAtX(xOfFrequency(600))).toBeCloseTo(600, 9);
    expect(frequencyAtX(0)).toBe(30);
    expect(frequencyAtX(GRAPH.width)).toBe(1000);
  });

  it("maps -100 to 0 dB from the bottom to the top and clamps levels outside it", () => {
    expect(levelY(0)).toBe(GRAPH.top);
    expect(levelY(-100)).toBe(GRAPH.top + GRAPH.plotHeight);
    expect(levelY(-50)).toBeCloseTo(GRAPH.top + GRAPH.plotHeight / 2, 9);
    expect(levelY(-120)).toBe(GRAPH.top + GRAPH.plotHeight);
    expect(levelY(3)).toBe(GRAPH.top);
  });

  it("draws the trace through every point in order", () => {
    const path = tracePath([
      { frequency: 30, magnitude: 1, db: 0 },
      { frequency: 1000, magnitude: 0, db: -120 },
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
});
