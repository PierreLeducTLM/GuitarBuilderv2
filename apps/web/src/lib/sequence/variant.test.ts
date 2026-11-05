import { describe, expect, it } from "vitest";
import { TEMPLATE_STEPS } from "./template";
import { type BuildVariant, displayedStepKey, displayGraph, stepApplies } from "./variant";

const has = (variant: BuildVariant, from: string, to: string) =>
  displayGraph(variant).arrows.some(([a, b]) => a === from && b === to);
const shown = (variant: BuildVariant) => displayGraph(variant).steps.map((step) => step.key);

describe("step applicability by variant", () => {
  it.each([
    [{ guitarType: "classical", boboNeck: true }, 120, 129],
    [{ guitarType: "classical", boboNeck: false }, 112, 120],
    [{ guitarType: "steel_string", boboNeck: true }, 120, 131],
    [{ guitarType: "steel_string", boboNeck: false }, 114, 124],
    [{ guitarType: null, boboNeck: true }, 132, 144],
    [{ guitarType: null, boboNeck: false }, 124, 135],
  ] as const)("%o shows %i steps and %i arrows", (variant, steps, arrows) => {
    const graph = displayGraph(variant);
    expect(graph.steps).toHaveLength(steps);
    expect(graph.arrows).toHaveLength(arrows);
  });

  it("hides steel-string-only steps on classical builds and the other way round", () => {
    expect(shown({ guitarType: "classical", boboNeck: true })).not.toContain("FabricateBridge");
    expect(shown({ guitarType: "classical", boboNeck: true })).toContain("FabricateCLBridge");
    expect(shown({ guitarType: "steel_string", boboNeck: true })).toContain("FabricateBridge");
    expect(shown({ guitarType: "steel_string", boboNeck: true })).not.toContain(
      "FabricateCLBridge",
    );
  });

  it("shows the CL BOBO-slat steps only with a BOBO neck on a classical or untyped build", () => {
    const slat = TEMPLATE_STEPS.filter(
      (step) => step.key === "CLGlueBOBO1" || step.key === "CLCutBOBO",
    );
    const applies = (variant: BuildVariant) => slat.map((step) => stepApplies(step, variant));
    expect(applies({ guitarType: "classical", boboNeck: true })).toEqual([true, true]);
    expect(applies({ guitarType: null, boboNeck: true })).toEqual([true, true]);
    expect(applies({ guitarType: "classical", boboNeck: false })).toEqual([false, false]);
    expect(applies({ guitarType: null, boboNeck: false })).toEqual([false, false]);
    expect(applies({ guitarType: "steel_string", boboNeck: true })).toEqual([false, false]);
  });

  it("hides the 6 BOBO-only steps without a BOBO neck, whatever the guitar type", () => {
    const bobo = [
      "BOBOFitLoose",
      "BOBONeckGroove",
      "BOBOGlueLosen",
      "MortiseHeelBolt",
      "MakeBoltBar",
      "RoutHeelMortise",
    ];
    for (const guitarType of ["classical", "steel_string", null] as const) {
      const keys = shown({ guitarType, boboNeck: false });
      for (const key of bobo) expect(keys).not.toContain(key);
      for (const key of bobo) expect(shown({ guitarType, boboNeck: true })).toContain(key);
    }
  });

  it("shows every classical-only and steel-string-only step when the guitar type is not set", () => {
    const keys = shown({ guitarType: null, boboNeck: false });
    for (const step of TEMPLATE_STEPS) {
      if (step.guitarType && !step.needsBobo) expect(keys).toContain(step.key);
    }
  });
});

describe("hidden step bridging", () => {
  it("bridges the fretboard chain on a steel-string build", () => {
    expect(has({ guitarType: "steel_string", boboNeck: true }, "RoutNut", "Crown")).toBe(true);
  });

  it("bridges neck assembly to the heel cap without a BOBO neck", () => {
    for (const guitarType of ["classical", "steel_string", null] as const) {
      expect(has({ guitarType, boboNeck: false }, "AssembleNeckRod", "MakeHeelCap")).toBe(true);
      expect(has({ guitarType, boboNeck: false }, "PreFitNeck", "MakeHeelCap")).toBe(true);
    }
  });

  it("leaves out a bridge whose target is already reachable", () => {
    const classical = { guitarType: "classical", boboNeck: true } as const;
    expect(has(classical, "BraceBridgePlate", "FitGlueBraces")).toBe(false);
    expect(has(classical, "CutBraceBlank", "BendFalcate")).toBe(true);
  });

  it("bridges the heel chain on a classical build", () => {
    expect(has({ guitarType: "classical", boboNeck: true }, "TaperThinHead", "PreCarveHeel")).toBe(
      true,
    );
  });

  it("never draws an arrow to or from a hidden step, nor the same arrow twice", () => {
    for (const guitarType of ["classical", "steel_string", null] as const) {
      for (const boboNeck of [true, false]) {
        const graph = displayGraph({ guitarType, boboNeck });
        const keys = new Set(graph.steps.map((step) => step.key));
        const seen = new Set<string>();
        for (const [from, to] of graph.arrows) {
          expect(keys.has(from) && keys.has(to)).toBe(true);
          expect(seen.has(`${from}>${to}`)).toBe(false);
          seen.add(`${from}>${to}`);
        }
      }
    }
  });
});

describe("displayedStepKey", () => {
  const classical = { guitarType: "classical", boboNeck: false } as const;

  it("accepts a step the build shows", () => {
    expect(displayedStepKey(classical, "FabricateCLBridge")).toBe("FabricateCLBridge");
  });

  it("refuses a step the variant hides", () => {
    expect(displayedStepKey(classical, "FabricateBridge")).toBeNull();
    expect(displayedStepKey(classical, "BOBOFitLoose")).toBeNull();
  });

  it("refuses anything that is not a step key", () => {
    expect(displayedStepKey(classical, "NoSuchStep")).toBeNull();
    expect(displayedStepKey(classical, "topPanel")).toBeNull();
  });
});
