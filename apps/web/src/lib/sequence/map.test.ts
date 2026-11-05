import { describe, expect, it } from "vitest";
import { groupGraph } from "./map";
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
const completed = (...keys: StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));
const FIRST_SIX_TRUSS_ROD: StepKey[] = [
  "TrussRod",
  "MakeTrussNut",
  "MakeTrussBlock",
  "CutBendRod",
  "ThreadRod",
  "AssembleParts",
];

const summary = (states: StepStates = {}) => groupGraph(steelPlain, states);
const find = (map: ReturnType<typeof groupGraph>, key: string) =>
  [...map.parts, ...map.assembly].find((group) => group.group.key === key);

describe("groupGraph", () => {
  it("lists the 10 component groups as parts, in group order", () => {
    expect(summary().parts.map((group) => group.group.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.each(VARIANTS)("orders the assembly groups and names what feeds them (%o)", (variant) => {
    const map = groupGraph(displayGraph(variant), {});
    expect(
      map.assembly.map((group) => [group.group.key, group.feeds.map((feed) => feed.key)]),
    ).toEqual([
      ["neck-assembly", ["truss-rod", "fretboard", "neck"]],
      ["body-assembly", ["top-panel", "back-panel", "sides", "end-blocks"]],
      ["heel-assembly", ["neck", "body-assembly"]],
      ["body-finish", ["neck-assembly", "heel-assembly", "body-assembly"]],
      ["final-assembly", ["bridge", "nut-saddle", "body-finish"]],
    ]);
  });

  it("shows that the top and back panels are fed from the braces, and other parts from nothing", () => {
    const feeds = summary().parts.map((group) => [
      group.group.key,
      group.feeds.map((feed) => feed.key),
    ]);
    expect(feeds).toEqual([
      ["truss-rod", []],
      ["fretboard", []],
      ["neck", []],
      ["top-panel", ["braces"]],
      ["braces", []],
      ["back-panel", ["braces"]],
      ["sides", []],
      ["end-blocks", []],
      ["bridge", []],
      ["nut-saddle", []],
    ]);
  });

  it("counts the displayed steps of each group", () => {
    const map = summary();
    expect([...map.parts, ...map.assembly].map((group) => group.total)).toEqual([
      7, 8, 10, 9, 9, 9, 9, 7, 9, 4, 7, 10, 4, 4, 8,
    ]);
    expect(find(map, "neck-assembly")?.steps.map((step) => step.key)).toEqual([
      "AssembleNeckRod",
      "DressEnds",
      "CarveNeck",
      "FitGlueHeadCap",
      "FitGlueFretsMarkers",
      "SandGrainFinish",
      "BuffNeckFitTuners",
    ]);
  });

  it("reads 6/7 and ready for a truss rod with its first six steps completed", () => {
    const map = summary(completed(...FIRST_SIX_TRUSS_ROD));
    expect(find(map, "truss-rod")).toMatchObject({ completed: 6, total: 7, state: "ready" });
    expect(find(map, "neck-assembly")).toMatchObject({
      completed: 0,
      total: 7,
      state: "notStarted",
    });
  });

  it("marks a group done when all its displayed steps are completed", () => {
    const map = summary(completed(...FIRST_SIX_TRUSS_ROD, "BindRod"));
    expect(find(map, "truss-rod")).toMatchObject({ completed: 7, total: 7, state: "done" });
  });

  it("does not count a completed step hidden by the variant", () => {
    const map = summary(completed("CLGlueBOBO1"));
    expect(find(map, "fretboard")).toMatchObject({ completed: 0, total: 8 });
  });

  it("marks a group with a ready step as ready even when nothing in it is completed", () => {
    const map = summary(completed("BindRod", "PressFrets", "TaperThinHead"));
    expect(find(map, "neck-assembly")?.state).toBe("ready");
  });
});
