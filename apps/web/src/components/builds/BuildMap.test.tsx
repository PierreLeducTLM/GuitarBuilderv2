// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_STEP_STATE, type StepStates } from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import { displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { BuildMap } from "./BuildMap";

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const completed = (...keys: readonly StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));
const FIRST_SIX: StepKey[] = [
  "TrussRod",
  "MakeTrussNut",
  "MakeTrussBlock",
  "CutBendRod",
  "ThreadRod",
  "AssembleParts",
];

const renderMap = (states: StepStates = {}, locale?: TestLocale) =>
  renderWithIntl(<BuildMap buildId="b1" graph={steelPlain} states={states} />, { locale });

const tiles = (list: string) =>
  within(screen.getByRole("list", { name: list })).getAllByRole("link");

describe("BuildMap", () => {
  it("shows the 10 parts in group order, each linking to its part flow", () => {
    renderMap();
    expect(screen.getByRole("region", { name: "Build map" })).toBeTruthy();
    const parts = tiles("Parts: start in any order");
    expect(parts).toHaveLength(10);
    expect(parts[0]?.getAttribute("href")).toBe("/builds/b1/map/truss-rod");
    expect(parts[9]?.getAttribute("href")).toBe("/builds/b1/map/nut-saddle");
  });

  it("orders the assembly tiles and names what feeds them", () => {
    renderMap();
    expect(tiles("Assembly").map((tile) => tile.textContent)).toEqual([
      "Neck assembly0/7from Truss rod, Fretboard, and Neck",
      "Body assembly0/10from Top panel, Back panel, Sides and bindings, and End blocks and linings",
      "Heel assembly0/4from Neck and Body assembly",
      "Body finish setup0/4from Neck assembly, Heel assembly, and Body assembly",
      "Final assembly0/8from Bridge, Nut and saddle, and Body finish setup",
    ]);
  });

  it("shows that the top and back panels are fed from the braces", () => {
    renderMap();
    const parts = tiles("Parts: start in any order");
    expect(parts[3]?.textContent).toContain("from Braces and bridge plate");
    expect(parts[5]?.textContent).toContain("from Braces and bridge plate");
    expect(parts[0]?.textContent).not.toContain("from");
  });

  it("names each tile's progress and state", () => {
    renderMap(completed(...FIRST_SIX));
    expect(
      screen.getByRole("link", { name: "Truss rod, 6 of 7 steps, Ready" }).getAttribute("href"),
    ).toBe("/builds/b1/map/truss-rod");
    expect(
      screen.getByRole("link", { name: "Neck assembly, 0 of 7 steps, Not started" }),
    ).toBeTruthy();
  });

  it("names a finished group as completed", () => {
    renderMap(completed(...FIRST_SIX, "BindRod"));
    expect(screen.getByRole("link", { name: "Truss rod, 7 of 7 steps, Completed" })).toBeTruthy();
  });

  it("explains the three states", () => {
    renderMap();
    expect(
      within(screen.getByRole("list", { name: "Step states" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Completed", "Ready", "Not started"]);
  });

  it("names the tiles in French", () => {
    renderMap({}, "fr");
    const parts = tiles("Pièces : dans n’importe quel ordre");
    expect(parts.slice(0, 3).map((tile) => tile.getAttribute("aria-label")?.split(",")[0])).toEqual(
      ["Tige de réglage", "Touche", "Manche"],
    );
  });
});
