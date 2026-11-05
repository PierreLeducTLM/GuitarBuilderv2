// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_STEP_STATE, type StepStates } from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import { displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl } from "@/test/intl";
import { SummaryStrip } from "./SummaryStrip";

const graph = displayGraph({ guitarType: "steel_string", boboNeck: false });
const completed = (...keys: StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));

describe("SummaryStrip", () => {
  it("links Next up to the first ready step's screen", () => {
    renderWithIntl(<SummaryStrip buildId="b1" graph={graph} states={completed("TrussRod")} />);
    const next = screen.getByRole("link", { name: /Next up: Make truss rod nut/ });
    expect(next.getAttribute("href")).toBe("/builds/b1/steps/MakeTrussNut");
  });

  it("says all steps are done when nothing is left", () => {
    const all = completed(...graph.steps.map((step) => step.key));
    renderWithIntl(<SummaryStrip buildId="b1" graph={graph} states={all} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("All steps done")).toBeTruthy();
  });
});
