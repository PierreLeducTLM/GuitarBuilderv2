// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTakeAnalysis } from "./useTakeAnalysis";

const SAMPLE_RATE = 48000;

const tapped = (onsets: readonly number[]) =>
  Float64Array.from({ length: 3 * SAMPLE_RATE }, (_, n) =>
    onsets.reduce((total, onset) => {
      if (n < onset) return total;
      const t = (n - onset) / SAMPLE_RATE;
      return total + 0.3 * Math.exp(-t / 0.1) * Math.sin(2 * Math.PI * 190 * t);
    }, 1e-4 * Math.sin(n)),
  );

const audioOf = (signal: Float64Array) => ({
  filtered: [signal],
  raw: [Float32Array.from(signal)],
  sampleRate: SAMPLE_RATE,
});

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await act(() => vi.runOnlyPendingTimersAsync());
};

afterEach(() => vi.useRealTimers());

describe("useTakeAnalysis", () => {
  it("analyses in steps and reports the result under the run that asked for it", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTakeAnalysis(dispatch));
    const audio = audioOf(tapped([24000, 76800]));
    act(() => result.current.analyse({ run: 7, audio, mode: "plate", mobile: false }));
    expect(dispatch).not.toHaveBeenCalled();
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [event] = dispatch.mock.calls[0] ?? [];
    expect(event).toMatchObject({ type: "analysisDone", run: 7, audio });
    expect(event.analysis.result.taps).toHaveLength(2);
  });

  it("abandons an analysis when a new one starts or the dialog closes", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result, unmount } = renderHook(() => useTakeAnalysis(dispatch));
    const audio = audioOf(tapped([24000, 76800]));
    act(() => result.current.analyse({ run: 1, audio, mode: "plate", mobile: false }));
    act(() => result.current.analyse({ run: 2, audio, mode: "plate", mobile: false }));
    await flush();
    expect(dispatch.mock.calls.map(([event]) => event.run)).toEqual([2]);
    act(() => result.current.analyse({ run: 3, audio, mode: "plate", mobile: false }));
    unmount();
    await flush();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("reports a failed analysis", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTakeAnalysis(dispatch));
    act(() =>
      result.current.analyse({
        run: 4,
        audio: { filtered: [], raw: [], sampleRate: SAMPLE_RATE },
        mode: "plate",
        mobile: false,
      }),
    );
    await flush();
    expect(dispatch).toHaveBeenCalledWith({ type: "analysisFailed", run: 4 });
  });

  it("treats a single sample as audio that cannot be analysed", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTakeAnalysis(dispatch));
    act(() =>
      result.current.analyse({
        run: 5,
        audio: audioOf(Float64Array.of(0.5)),
        mode: "plate",
        mobile: false,
      }),
    );
    await flush();
    expect(dispatch.mock.calls).toEqual([[{ type: "analysisFailed", run: 5 }]]);
  });

  it("does not report the failure of an abandoned run", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const { result } = renderHook(() => useTakeAnalysis(dispatch));
    act(() =>
      result.current.analyse({
        run: 8,
        audio: audioOf(new Float64Array(0)),
        mode: "plate",
        mobile: false,
      }),
    );
    act(() =>
      result.current.analyse({
        run: 9,
        audio: audioOf(tapped([24000])),
        mode: "plate",
        mobile: false,
      }),
    );
    await flush();
    expect(dispatch.mock.calls.map(([event]) => event.run)).toEqual([9]);
  });
});
