import type { StepMeasurement } from "@gb/db";
import { describe, expect, it } from "vitest";
import {
  EMPTY_STEP_STATE,
  latestMeasurement,
  mergeStepState,
  nextUp,
  progress,
  type StepStates,
  stepState,
  stepStatus,
} from "./state";
import { STEP_KEYS, type StepKey } from "./template";
import { displayGraph } from "./variant";

const steelBobo = displayGraph({ guitarType: "steel_string", boboNeck: true });
const completed = (...keys: StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));

function measurement(id: string, timestamp: number, frequency: number): StepMeasurement {
  return {
    id,
    timestamp,
    description: "Resonance Analysis",
    frequency,
    spectrum: {
      frequencies: [100],
      magnitudes: [0.1],
      magnitudesDb: [-40],
      sampleRate: 48000,
      fftSize: 16384,
      binWidth: 2.9296875,
    },
  };
}

describe("step state loading", () => {
  it("treats a build without stored state as all steps empty", () => {
    expect(mergeStepState([])).toEqual({});
    expect(mergeStepState(null)).toEqual({});
    expect(stepState({}, "Neck")).toEqual({
      completed: false,
      notes: "",
      photos: [],
      measurements: [],
    });
  });

  it("reads an older entry with only a key and a completed flag as empty otherwise", () => {
    expect(mergeStepState([{ key: "Neck", completed: true }]).Neck).toEqual({
      completed: true,
      notes: "",
      photos: [],
      measurements: [],
    });
  });

  it("ignores entries whose key is not in the template and skips malformed items", () => {
    const states = mergeStepState([
      { key: "RetiredStep", completed: true },
      "garbage",
      {
        key: "JoinPanels",
        notes: "Glued",
        photos: [{ url: "u", name: "n" }, { url: 3 }],
        measurements: [measurement("m1", 1, 187.4), { id: "broken" }],
      },
    ]);
    expect(Object.keys(states)).toEqual(["JoinPanels"]);
    expect(states.JoinPanels?.photos).toEqual([{ url: "u", name: "n" }]);
    expect(states.JoinPanels?.measurements.map((m) => m.id)).toEqual(["m1"]);
  });
});

describe("ready steps", () => {
  it("shows exactly the starting steps as ready on a new build", () => {
    const ready = steelBobo.steps.filter((step) => stepStatus(steelBobo, {}, step.key) === "ready");
    expect(ready.map((step) => step.key)).toEqual([
      "TrussRod",
      "Fretboard",
      "Neck",
      "TopPanel",
      "BraceBridgePlate",
      "BackPanel",
      "SidesBindings",
      "EndBlockLinings",
      "Bridge",
      "NutSaddle",
    ]);
  });

  it("makes FitTopBack ready once its three predecessors are completed", () => {
    const states = completed("FitGlueBraces", "FitGlueBracesBack", "FitSideMould");
    expect(stepStatus(steelBobo, states, "FitTopBack")).toBe("ready");
    expect(stepStatus(steelBobo, states, "GlueTopBack")).toBe("notStarted");
    expect(stepStatus(steelBobo, states, "FitGlueBraces")).toBe("completed");
  });

  it("follows the displayed (bridged) predecessors of a variant", () => {
    const steel = completed("RoutNut");
    expect(stepStatus(steelBobo, steel, "Crown")).toBe("ready");
  });
});

describe("progress and next up", () => {
  it('reads "30 of 120 steps · 25%"', () => {
    const states = completed(...steelBobo.steps.slice(0, 30).map((step) => step.key));
    expect(progress(steelBobo, states)).toEqual({ completed: 30, total: 120, percent: 25 });
  });

  it("does not count a completed step hidden by the variant", () => {
    const classical = displayGraph({ guitarType: "classical", boboNeck: true });
    const states = completed(
      ...classical.steps.slice(0, 12).map((step) => step.key),
      "FabricateBridge",
    );
    expect(progress(classical, states)).toEqual({ completed: 12, total: 120, percent: 10 });
  });

  it("shows 0 of 112 for an untouched classical build without a BOBO neck", () => {
    const graph = displayGraph({ guitarType: "classical", boboNeck: false });
    expect(progress(graph, {})).toEqual({ completed: 0, total: 112, percent: 0 });
  });

  it("names the first ready step in template order, or nothing when all are done", () => {
    expect(nextUp(steelBobo, {})).toBe("TrussRod");
    expect(nextUp(steelBobo, completed("TrussRod"))).toBe("MakeTrussNut");
    expect(nextUp(steelBobo, completed(...STEP_KEYS))).toBeNull();
  });

  it("finds the latest measurement among the displayed steps", () => {
    const states: StepStates = {
      TapTestPanels: { ...EMPTY_STEP_STATE, measurements: [measurement("a", 100, 150.2)] },
      JoinPanels: { ...EMPTY_STEP_STATE, measurements: [measurement("b", 300, 181.6)] },
      // Hidden on a steel-string build: ignored.
      FabricateCLBridge: { ...EMPTY_STEP_STATE, measurements: [measurement("c", 900, 99)] },
    };
    expect(latestMeasurement(steelBobo, states)?.frequency).toBe(181.6);
    expect(latestMeasurement(steelBobo, {})).toBeNull();
  });
});

describe("stored body roles", () => {
  const stored = (roles: unknown) =>
    mergeStepState([
      {
        key: "TapTestPanels",
        completed: false,
        notes: "",
        photos: [],
        measurements: [
          { ...measurement("m1", 1, 196.94), ...(roles === undefined ? {} : { roles }) },
        ],
      },
    ]).TapTestPanels?.measurements[0];

  it("keeps the Air, Top and Back roles of a measurement", () => {
    const top = { frequency: 196.94, level: -21.3, spectralQ: 31.2, decayQ: null, origin: "user" };
    const air = { frequency: 98.41, level: -18, spectralQ: null, decayQ: 40.5, origin: "auto" };
    expect(stored({ top, air })?.roles).toEqual({ top, air });
  });

  it("skips a malformed role and keeps the others", () => {
    const back = { frequency: 247.5, level: -25, spectralQ: 20, decayQ: 30, origin: "auto" };
    expect(
      stored({
        back,
        top: { frequency: "196", level: -20, spectralQ: 1, decayQ: 1, origin: "auto" },
        air: { frequency: 98, level: -20, spectralQ: 1, decayQ: 1, origin: "guess" },
        side: back,
      })?.roles,
    ).toEqual({ back });
  });

  it("leaves measurements without roles, or with none valid, without a roles field", () => {
    expect(stored(undefined)).not.toHaveProperty("roles");
    expect(stored({ top: "x" })).not.toHaveProperty("roles");
    expect(stored("roles")).not.toHaveProperty("roles");
  });
});
