import { runTake, type TakeAnalysis, type TakeMode } from "@gb/dsp";
import { describe, expect, it } from "vitest";
import {
  canConfirm,
  createDialog,
  type DialogEvent,
  type DialogState,
  effectiveRoles,
  instrumentResult,
  plateResults,
  reduce,
  selectedPeak,
} from "./machine";

const SAMPLE_RATE = 48000;
type Mode = { frequency: number; amplitude: number; tau: number };

const synth = (seconds: number, onsets: readonly number[], modes: readonly Mode[]) =>
  Float64Array.from({ length: seconds * SAMPLE_RATE }, (_, n) =>
    onsets.reduce((total, onset) => {
      if (n < onset) return total;
      const t = (n - onset) / SAMPLE_RATE;
      return (
        total +
        modes.reduce(
          (s, m) =>
            s + m.amplitude * Math.exp(-t / m.tau) * Math.sin(2 * Math.PI * m.frequency * t),
          0,
        )
      );
    }, 1e-4 * Math.sin(n)),
  );

const analysisOf = (signal: Float64Array, mode: TakeMode = "plate"): TakeAnalysis =>
  runTake({ filtered: signal, raw: [signal], sampleRate: SAMPLE_RATE, mode, mobile: false });

const plateSignal = synth(
  4,
  [24000, 76800, 132000],
  [
    { frequency: 190, amplitude: 0.3, tau: 0.12 },
    { frequency: 95, amplitude: 0.2, tau: 0.15 },
  ],
);
const plate = analysisOf(plateSignal);
const body = analysisOf(
  synth(
    5,
    [48000, 105600, 163200],
    [
      { frequency: 98.4, amplitude: 0.25, tau: 0.05 },
      { frequency: 196.9, amplitude: 0.3, tau: 0.06 },
      { frequency: 247.5, amplitude: 0.2, tau: 0.05 },
    ],
  ),
  "instrument",
);
const silence = analysisOf(new Float64Array(2 * SAMPLE_RATE));
const audio = {
  filtered: [plateSignal],
  raw: [Float32Array.from(plateSignal)],
  sampleRate: SAMPLE_RATE,
};

const run = (state: DialogState, ...events: DialogEvent[]) => events.reduce(reduce, state);

const analysed = (state: DialogState, analysis: TakeAnalysis): DialogState => {
  const started = reduce(state, { type: "analysisStarted" });
  const take = started.takes[started.active];
  if (take?.status !== "analyzing") throw new Error("expected analyzing");
  return reduce(started, { type: "analysisDone", run: take.run, analysis, audio });
};

const instrumentWith = (analysis: TakeAnalysis) =>
  analysed(createDialog({ mode: "instrument" }), analysis);

describe("a take's lifecycle", () => {
  it("goes idle, recording, analyzing, results", () => {
    const recording = run(createDialog({ mode: "instrument" }), { type: "recordingStarted" });
    expect(recording.takes.instrument?.status).toBe("recording");
    const results = analysed(recording, body);
    expect(results.takes.instrument?.status).toBe("results");
    expect(selectedPeak(results.takes.instrument)?.frequency).toBe(body.result.peaks[0]?.frequency);
  });

  it("returns to idle with 'No tap detected' when the audio holds no tap", () => {
    const state = analysed(createDialog({ mode: "instrument" }), silence);
    expect(state.takes.instrument?.status).toBe("idle");
    expect(state.error).toEqual({ key: "noTap" });
  });

  it("returns to idle with the error when the analysis fails", () => {
    const started = reduce(createDialog({ mode: "instrument" }), { type: "analysisStarted" });
    const take = started.takes.instrument;
    const failed = reduce(started, {
      type: "analysisFailed",
      run: take?.status === "analyzing" ? take.run : -1,
    });
    expect(failed.takes.instrument?.status).toBe("idle");
    expect(failed.error).toEqual({ key: "processing" });
  });

  it("stays idle with the error when the microphone or a file is refused, and a new attempt clears it", () => {
    const refused = reduce(createDialog({ mode: "instrument" }), {
      type: "failed",
      error: { key: "microphone" },
    });
    expect(refused.takes.instrument?.status).toBe("idle");
    expect(refused.error).toEqual({ key: "microphone" });
    expect(reduce(refused, { type: "recordingStarted" }).error).toBeNull();
    expect(reduce(refused, { type: "analysisStarted" }).error).toBeNull();
  });

  it("drops a recording that is cancelled, but never a take that already has results", () => {
    const state = run(
      createDialog({ mode: "instrument" }),
      { type: "recordingStarted" },
      { type: "recordingCancelled" },
    );
    expect(state.takes.instrument?.status).toBe("idle");
    expect(
      reduce(instrumentWith(body), { type: "recordingCancelled" }).takes.instrument?.status,
    ).toBe("results");
  });

  it("ignores a selection outside the detected peaks", () => {
    const state = reduce(instrumentWith(body), { type: "peakSelected", index: 99 });
    expect(selectedPeak(state.takes.instrument)?.frequency).toBe(body.result.peaks[0]?.frequency);
  });

  it("ignores the result of a run that was superseded or abandoned", () => {
    const first = reduce(createDialog({ mode: "instrument" }), { type: "analysisStarted" });
    const oldRun = first.takes.instrument?.status === "analyzing" ? first.takes.instrument.run : -1;
    const second = run(first, { type: "reRecorded" }, { type: "analysisStarted" });
    const late = reduce(second, { type: "analysisDone", run: oldRun, analysis: body, audio });
    expect(late.takes.instrument?.status).toBe("analyzing");
    const lateFailure = reduce(second, { type: "analysisFailed", run: oldRun });
    expect(lateFailure.error).toBeNull();
  });
});

describe("Plate takes", () => {
  it("records and re-records each take on its own", () => {
    const longitudinal = analysed(createDialog({ mode: "plate" }), plate);
    const cross = analysed(
      reduce(longitudinal, { type: "takeSwitched", take: "crossGrain" }),
      plate,
    );
    const redone = reduce(cross, { type: "reRecorded" });
    expect(redone.takes.crossGrain?.status).toBe("idle");
    expect(redone.takes.longitudinal?.status).toBe("results");
  });

  it("cannot switch takes while recording", () => {
    const recording = reduce(createDialog({ mode: "plate" }), { type: "recordingStarted" });
    expect(reduce(recording, { type: "takeSwitched", take: "diagonal" }).active).toBe(
      "longitudinal",
    );
    const stopped = reduce(recording, { type: "analysisStarted" });
    expect(reduce(stopped, { type: "takeSwitched", take: "diagonal" }).active).toBe("diagonal");
  });

  it("reopens a take on its saved record with the peak nearest the current value", () => {
    const record = plate.result.record;
    if (!record) throw new Error("expected a record");
    const state = createDialog({
      mode: "plate",
      saved: { crossGrain: record },
      current: { crossGrain: 96 },
    });
    const take = state.takes.crossGrain;
    expect(take?.status).toBe("results");
    expect(Math.round(selectedPeak(take)?.frequency ?? 0)).toBe(95);
    expect(take?.status === "results" && take.audio).toBeNull();
    expect(
      createDialog({ mode: "plate", saved: { crossGrain: record } }).takes.crossGrain,
    ).toMatchObject({ selected: 0 });
    expect(state.takes.longitudinal?.status).toBe("idle");
  });

  it("returns every take with a selected peak on Confirm", () => {
    const state = run(analysed(createDialog({ mode: "plate" }), plate), {
      type: "peakSelected",
      index: 1,
    });
    const results = plateResults(state);
    expect(Object.keys(results)).toEqual(["longitudinal"]);
    expect(Math.round(results.longitudinal?.frequency ?? 0)).toBe(95);
    expect(results.longitudinal?.record).toBe(plate.result.record);
    expect(results.longitudinal?.spectralQ).toBe(plate.result.peaks[1]?.spectralQ?.q ?? null);
  });
});

describe("taps", () => {
  it("re-averages after a tap is excluded or re-included, keeping the closest selection", () => {
    const state = run(analysed(createDialog({ mode: "plate" }), plate), {
      type: "peakSelected",
      index: 1,
    });
    const without2 = reduce(state, { type: "tapToggled", number: 2 });
    const take = without2.takes.longitudinal;
    expect(take?.status === "results" && take.result.used).toEqual([1, 3]);
    expect(Math.round(selectedPeak(take)?.frequency ?? 0)).toBe(95);
    const back = reduce(without2, { type: "tapToggled", number: 2 });
    expect(
      back.takes.longitudinal?.status === "results" && back.takes.longitudinal.result.used,
    ).toEqual([1, 2, 3]);
  });

  it("selects nothing once every tap is excluded", () => {
    const state = run(
      analysed(createDialog({ mode: "plate" }), plate),
      ...[1, 2, 3].map((number) => ({ type: "tapToggled" as const, number })),
    );
    expect(selectedPeak(state.takes.longitudinal)).toBeUndefined();
    expect(canConfirm(state)).toBe(false);
  });
});

describe("body roles", () => {
  const peakNear = (state: DialogState, frequency: number) => {
    const take = state.takes.instrument;
    return take?.status === "results"
      ? take.result.peaks.findIndex((p) => Math.abs(p.frequency - frequency) < 2)
      : -1;
  };

  it("uses the automatic roles until the user moves or clears one", () => {
    const state = instrumentWith(body);
    const roles = effectiveRoles(state.takes.instrument);
    expect(Math.round(roles.top?.frequency ?? 0)).toBe(197);
    expect(roles.top?.origin).toBe("auto");
    const moved = reduce(state, {
      type: "roleAssigned",
      role: "top",
      index: peakNear(state, 247.5),
    });
    expect(Math.round(effectiveRoles(moved.takes.instrument).top?.frequency ?? 0)).toBe(248);
    expect(effectiveRoles(moved.takes.instrument).top?.origin).toBe("user");
    const cleared = reduce(moved, { type: "roleCleared", role: "back" });
    expect(effectiveRoles(cleared.takes.instrument).back).toBeNull();
  });

  it("keeps a user-set role on the nearest peak after a tap is excluded", () => {
    const state = run(
      instrumentWith(body),
      { type: "roleAssigned", role: "air", index: peakNear(instrumentWith(body), 196.9) },
      { type: "tapToggled", number: 3 },
    );
    expect(Math.round(effectiveRoles(state.takes.instrument).air?.frequency ?? 0)).toBe(197);
  });

  it("returns the main peak and the roles on Confirm, and needs a selected peak", () => {
    const state = instrumentWith(body);
    const result = instrumentResult(state);
    expect(result?.frequency).toBe(body.result.peaks[0]?.frequency);
    expect(Object.keys(result?.roles ?? {}).sort()).toEqual(["air", "back", "top"]);
    expect(result?.roles.top).toMatchObject({ origin: "auto" });
    expect(canConfirm(state)).toBe(true);
    expect(canConfirm(createDialog({ mode: "instrument" }))).toBe(false);
  });
});
