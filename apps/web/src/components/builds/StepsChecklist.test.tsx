// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EMPTY_STEP_STATE, type StepStates } from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import { displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { StepsChecklist } from "./StepsChecklist";

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const completed = (...keys: readonly StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));

function renderChecklist(
  states: StepStates = {},
  { current, locale }: { current?: StepKey; locale?: TestLocale } = {},
) {
  return renderWithIntl(
    <StepsChecklist buildId="b1" graph={steelPlain} states={states} currentKey={current} />,
    { locale },
  );
}

const readyNow = () => screen.getByRole("list", { name: "Ready now" });
const section = (name: RegExp) => screen.getByRole("button", { name });

describe("StepsChecklist", () => {
  it("lists the 10 starting steps of a new build as ready now, Truss rod first", () => {
    renderChecklist();
    const rows = within(readyNow()).getAllByRole("link");
    expect(rows).toHaveLength(10);
    expect(rows[0]?.getAttribute("href")).toBe("/builds/b1/steps/TrussRod");
    expect(rows[0]?.textContent).toContain("001");
    expect(rows[0]?.textContent).toContain("Truss rod");
  });

  it("titles each group section with its name and progress, in group order", () => {
    renderChecklist();
    const titles = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    expect(titles.slice(0, 3)).toEqual(["Truss rod0/7", "Fretboard0/8", "Neck0/10"]);
    expect(titles.slice(10)).toEqual([
      "Neck assembly0/7",
      "Body finish setup0/4",
      "Heel assembly0/4",
      "Body assembly0/10",
      "Final assembly0/8",
    ]);
  });

  it("unfolds the sections that hold a ready step and folds the others", () => {
    renderChecklist();
    expect(section(/^Truss rod/).getAttribute("aria-expanded")).toBe("true");
    expect(section(/^Body assembly/).getAttribute("aria-expanded")).toBe("false");
    const panel = document.getElementById(
      section(/^Truss rod/).getAttribute("aria-controls") ?? "",
    );
    expect(within(panel as HTMLElement).getAllByRole("link")).toHaveLength(7);
  });

  it("lists a folded section's steps in template order once unfolded", async () => {
    renderChecklist();
    await userEvent.click(section(/^Body assembly/));
    expect(section(/^Body assembly/).getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(
      section(/^Body assembly/).getAttribute("aria-controls") ?? "",
    ) as HTMLElement;
    const links = within(panel).getAllByRole("link");
    expect(links).toHaveLength(10);
    expect(links[0]?.textContent).toContain("115");
    expect(links[9]?.textContent).toContain("124");
  });

  it("folds an unfolded section again", async () => {
    renderChecklist();
    await userEvent.click(section(/^Truss rod/));
    expect(section(/^Truss rod/).getAttribute("aria-expanded")).toBe("false");
    expect(section(/^Fretboard/).getAttribute("aria-expanded")).toBe("true");
    expect(
      document.getElementById(section(/^Truss rod/).getAttribute("aria-controls") ?? ""),
    ).toBeNull();
  });

  it("names each row's state, so completed and ready steps can be told apart", () => {
    renderChecklist(completed("TrussRod"));
    expect(screen.getByRole("link", { name: "Step 001: Truss rod, Completed" })).toBeTruthy();
    expect(
      screen.getAllByRole("link", { name: "Step 002: Make truss rod nut, Ready" }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Step 004: Cut and bend rod, Not started" }),
    ).toBeTruthy();
    expect(screen.getByText("1/7")).toBeTruthy();
  });

  it("is a landmark named Steps", () => {
    renderChecklist();
    expect(screen.getByRole("region", { name: "Steps" })).toBeTruthy();
  });

  it("marks a ready step shown beside the checklist as current in both of its rows", () => {
    renderChecklist({}, { current: "TrussRod" });
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("href"))).toEqual([
      "/builds/b1/steps/TrussRod",
      "/builds/b1/steps/TrussRod",
    ]);
  });

  it("marks the step shown beside the checklist as current", () => {
    renderChecklist({}, { current: "MakeTrussBlock" });
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("href"))).toEqual([
      "/builds/b1/steps/MakeTrussBlock",
    ]);
  });

  it("replaces Ready now with All steps done when every step is completed", () => {
    renderChecklist(completed(...steelPlain.steps.map((step) => step.key)));
    expect(screen.queryByRole("list", { name: "Ready now" })).toBeNull();
    expect(screen.getByText("All steps done")).toBeTruthy();
  });

  it("is in French", () => {
    renderChecklist({}, { locale: "fr" });
    expect(screen.getByRole("list", { name: "Prêtes maintenant" })).toBeTruthy();
    expect(section(/^Tige de réglage/)).toBeTruthy();
  });
});
