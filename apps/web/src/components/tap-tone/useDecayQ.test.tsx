// @vitest-environment jsdom
import { runTake } from "@gb/dsp";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDialog, reduce, type Take } from "@/lib/tap-tone/machine";
import { useDecayQ } from "./useDecayQ";

const SAMPLE_RATE = 48000;
const signal = Float64Array.from({ length: 4 * SAMPLE_RATE }, (_, n) =>
  [24000, 76800, 132000].reduce(
    (total, onset) => {
      if (n < onset) return total;
      const t = (n - onset) / SAMPLE_RATE;
      return total + 0.3 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 190 * t);
    },
    2e-4 * Math.sin(n * 1.7),
  ),
);
const analysis = runTake({
  filtered: signal,
  raw: [signal],
  sampleRate: SAMPLE_RATE,
  mode: "plate",
  mobile: false,
});
const audio = { filtered: [signal], raw: [Float32Array.from(signal)], sampleRate: SAMPLE_RATE };

const resultsTake = (): Take => {
  const started = reduce(createDialog({ mode: "instrument" }), { type: "analysisStarted" });
  return (
    reduce(started, { type: "analysisDone", run: 1, analysis, audio }).takes.instrument ?? {
      status: "idle",
    }
  );
};

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await act(() => vi.runOnlyPendingTimersAsync());
};

afterEach(() => vi.useRealTimers());

describe("useDecayQ", () => {
  it("is pending at first, then gives the decay Q of the peak", async () => {
    vi.useFakeTimers();
    const take = resultsTake();
    const peak = analysis.result.peaks[0];
    if (!peak) throw new Error("expected a peak");
    const { result } = renderHook(() => useDecayQ(take, [peak]));
    expect(result.current(peak).view).toBe("pending");
    await flush();
    const { view, decay } = result.current(peak);
    expect(view !== "pending" && view.value).toBeCloseTo(Math.PI * 190 * 0.12, -1);
    expect(decay?.used).toBe(3);
  });

  it("measures every requested peak, one after the other", async () => {
    vi.useFakeTimers();
    const take = resultsTake();
    const [first, second] = analysis.result.peaks;
    const other = second ?? { frequency: 95, level: -40, spectralQ: null };
    if (!first) throw new Error("expected a peak");
    const { result } = renderHook(() => useDecayQ(take, [first, other]));
    await flush();
    expect(result.current(first).view).not.toBe("pending");
    expect(result.current(other).view).not.toBe("pending");
  });

  it("serves a second request for the same peak from memory", async () => {
    vi.useFakeTimers();
    const take = resultsTake();
    const peak = analysis.result.peaks[0];
    if (!peak) throw new Error("expected a peak");
    const { result, rerender } = renderHook(({ targets }) => useDecayQ(take, targets), {
      initialProps: { targets: [peak] },
    });
    await flush();
    const first = result.current(peak).decay;
    rerender({ targets: [] });
    rerender({ targets: [peak] });
    expect(result.current(peak).decay).toBe(first);
  });

  it("explains that a saved spectrum needs the recording", () => {
    const record = analysis.result.record;
    if (!record) throw new Error("expected a record");
    const saved = createDialog({ mode: "plate", saved: { longitudinal: record } }).takes
      .longitudinal;
    const peak = analysis.result.peaks[0];
    if (!peak) throw new Error("expected a peak");
    const { result } = renderHook(() => useDecayQ(saved, [peak]));
    expect(result.current(peak).view).toEqual({ value: null, reason: "noRecording" });
  });

  it("gives the reason when the analysis refuses a value", async () => {
    vi.useFakeTimers();
    const started = reduce(createDialog({ mode: "instrument" }), { type: "analysisStarted" });
    const twoTaps = reduce(reduce(started, { type: "analysisDone", run: 1, analysis, audio }), {
      type: "tapToggled",
      number: 3,
    }).takes.instrument;
    const peak = twoTaps?.status === "results" ? twoTaps.result.peaks[0] : undefined;
    if (!peak) throw new Error("expected a peak");
    const { result } = renderHook(() => useDecayQ(twoTaps, [peak]));
    await flush();
    expect(result.current(peak).view).toEqual({ value: null, reason: "TOO_FEW_VALID_TAPS" });
  });
});
