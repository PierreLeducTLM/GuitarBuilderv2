import { describe, expect, it } from "vitest";
import { waveformColumns } from "./waveform";

describe("waveform columns", () => {
  it("keeps each column's lowest and highest sample", () => {
    expect(waveformColumns(Float64Array.of(0.1, -0.5, 0.9, 0.2, -0.1, 0.3), 2)).toEqual([
      { min: -0.5, max: 0.9 },
      { min: -0.1, max: 0.3 },
    ]);
  });

  it("covers every sample when the length does not divide evenly", () => {
    const columns = waveformColumns(Float64Array.of(0, 0, 0, 0, 0.8), 2);
    expect(columns).toHaveLength(2);
    expect(columns[1]?.max).toBe(0.8);
  });

  it("gives flat columns for silence and none for no audio", () => {
    expect(waveformColumns(new Float64Array(4), 2)).toEqual([
      { min: 0, max: 0 },
      { min: 0, max: 0 },
    ]);
    expect(waveformColumns(new Float64Array(0), 4)).toEqual([]);
  });
});
