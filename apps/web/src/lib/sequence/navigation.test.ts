import { describe, expect, it } from "vitest";
import { nextAfterDone, stepContext, stepNeighbours } from "./navigation";
import { EMPTY_STEP_STATE, type StepStates } from "./state";
import type { StepKey } from "./template";
import { type BuildVariant, displayGraph } from "./variant";

const VARIANTS: readonly BuildVariant[] = [
  { guitarType: "classical", boboNeck: true },
  { guitarType: "classical", boboNeck: false },
  { guitarType: "steel_string", boboNeck: true },
  { guitarType: "steel_string", boboNeck: false },
  { guitarType: null, boboNeck: true },
  { guitarType: null, boboNeck: false },
];

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const completed = (...keys: readonly StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));
const allBut = (...open: readonly StepKey[]) =>
  completed(...steelPlain.steps.map((step) => step.key).filter((key) => !open.includes(key)));

describe("stepContext", () => {
  it("names what a step comes after, whether it is done, and what it leads to in other groups", () => {
    const context = stepContext(steelPlain, completed("AssembleParts"), "BindRod");
    expect(
      context.after.map((link) => [link.key, link.completed, link.group?.key ?? null]),
    ).toEqual([["AssembleParts", true, null]]);
    expect(context.leadsTo.map((link) => [link.key, link.group?.key ?? null])).toEqual([
      ["AssembleNeckRod", "neck-assembly"],
    ]);
    expect(context.starting).toBe(false);
    expect(context.last).toBe(false);
  });

  it("marks an unfinished predecessor as not completed", () => {
    const context = stepContext(steelPlain, {}, "BindRod");
    expect(context.after.map((link) => link.completed)).toEqual([false]);
  });

  it("reads a starting step as the start of its group, leading to both of its successors", () => {
    const context = stepContext(steelPlain, {}, "TrussRod");
    expect(context.starting).toBe(true);
    expect(context.after).toEqual([]);
    expect(context.leadsTo.map((link) => [link.key, link.group])).toEqual([
      ["MakeTrussNut", null],
      ["MakeTrussBlock", null],
    ]);
  });

  it("names the other group of a predecessor", () => {
    const context = stepContext(steelPlain, {}, "AssembleNeckRod");
    expect(context.after.map((link) => [link.key, link.group?.key])).toEqual([
      ["BindRod", "truss-rod"],
      ["PressFrets", "fretboard"],
      ["TaperThinHead", "neck"],
    ]);
  });

  it.each(VARIANTS)("knows OptimiseAcoustic as the only last step (%o)", (variant) => {
    const graph = displayGraph(variant);
    const last = graph.steps.filter((step) => stepContext(graph, {}, step.key).last);
    expect(last.map((step) => step.key)).toEqual(["OptimiseAcoustic"]);
  });
});

describe("stepNeighbours", () => {
  it("moves through the displayed steps in template order", () => {
    expect(stepNeighbours(steelPlain, "ThreadRod")).toEqual({
      previous: "CutBendRod",
      next: "AssembleParts",
    });
  });

  it("skips a step hidden by the variant", () => {
    expect(stepNeighbours(steelPlain, "Crown").previous).toBe("RoutNut");
    expect(stepNeighbours(steelPlain, "RoutNut").next).toBe("Crown");
  });

  it("has nothing before the first step and nothing after the last", () => {
    expect(stepNeighbours(steelPlain, "TrussRod").previous).toBeNull();
    expect(stepNeighbours(steelPlain, "OptimiseAcoustic").next).toBeNull();
  });
});

describe("nextAfterDone", () => {
  it("opens the next ready step after the one just completed", () => {
    expect(nextAfterDone(steelPlain, completed("TopPanel"), "CutRectangle")).toBe(
      "ReduceThickness",
    );
  });

  it("skips ready steps that come before the one just completed", () => {
    expect(nextAfterDone(steelPlain, {}, "MakeTrussNut")).toBe("Fretboard");
  });

  it("wraps around to the first ready step when none comes after", () => {
    const fretboard = steelPlain.steps.filter((step) => step.group === 2).map((step) => step.key);
    expect(
      nextAfterDone(steelPlain, allBut(...fretboard, "OptimiseAcoustic"), "OptimiseAcoustic"),
    ).toBe("Fretboard");
  });

  it("gives nothing when the last remaining step is done", () => {
    expect(nextAfterDone(steelPlain, allBut("BindRod"), "BindRod")).toBeNull();
  });

  it("does not offer the step just completed again", () => {
    expect(nextAfterDone(steelPlain, allBut("TrussRod", "Fretboard"), "Fretboard")).toBe(
      "TrussRod",
    );
  });
});
