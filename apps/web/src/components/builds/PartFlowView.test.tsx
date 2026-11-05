// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { groupByKey, type TemplateGroup } from "@/lib/sequence/groups";
import { EMPTY_STEP_STATE, type StepStates } from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import { type BuildVariant, displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { PartFlowView } from "./PartFlowView";

const completed = (...keys: readonly StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));

function renderFlow(
  key: string,
  {
    states = {},
    variant = { guitarType: "steel_string", boboNeck: false },
    locale,
  }: { states?: StepStates; variant?: BuildVariant; locale?: TestLocale } = {},
) {
  const group = groupByKey(key) as TemplateGroup;
  return renderWithIntl(
    <PartFlowView buildId="b1" graph={displayGraph(variant)} states={states} group={group} />,
    { locale },
  );
}

const steps = () => within(screen.getByRole("list", { name: /^Steps of / })).getAllByRole("link");

describe("PartFlowView", () => {
  it("titles the flow with the group and its progress, with a way back to the map", () => {
    renderFlow("truss-rod", { states: completed("TrussRod", "MakeTrussNut") });
    expect(screen.getByRole("heading", { name: "Truss rod" })).toBeTruthy();
    expect(screen.getByText("2 / 7 done")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Map" }).getAttribute("href")).toBe("/builds/b1/map");
  });

  it("shows the group's steps top to bottom, each opening its step screen from this part", () => {
    renderFlow("truss-rod");
    expect(steps().map((step) => step.getAttribute("href"))).toEqual([
      "/builds/b1/steps/TrussRod?from=truss-rod",
      "/builds/b1/steps/MakeTrussNut?from=truss-rod",
      "/builds/b1/steps/MakeTrussBlock?from=truss-rod",
      "/builds/b1/steps/CutBendRod?from=truss-rod",
      "/builds/b1/steps/ThreadRod?from=truss-rod",
      "/builds/b1/steps/AssembleParts?from=truss-rod",
      "/builds/b1/steps/BindRod?from=truss-rod",
    ]);
    expect(steps().every((step) => step.getAttribute("draggable") !== "true")).toBe(true);
  });

  it("names each box with its number, label and state", () => {
    renderFlow("truss-rod", { states: completed("TrussRod") });
    expect(screen.getByRole("link", { name: "Step 001: Truss rod, Completed" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Step 002: Make truss rod nut, Ready" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Step 004: Cut and bend rod, Not started" }),
    ).toBeTruthy();
  });

  it("puts the nut and the stop block side by side in one row", () => {
    renderFlow("truss-rod");
    const rows = screen.getAllByTestId("flow-row");
    expect(rows.map((row) => within(row).getAllByRole("link").length)).toEqual([1, 2, 1, 1, 1, 1]);
  });

  it("leads from the truss rod to neck assembly", () => {
    renderFlow("truss-rod");
    const leadsTo = screen.getByRole("list", { name: "Leads to" });
    const link = within(leadsTo).getByRole("link");
    expect(link.textContent).toBe("Assemble neck, rod, fretboard (Neck assembly)");
    expect(link.getAttribute("href")).toBe("/builds/b1/map/neck-assembly");
    expect(screen.queryByRole("list", { name: "Comes from" })).toBeNull();
  });

  it("comes into neck assembly from the truss rod, the fretboard and the neck", () => {
    renderFlow("neck-assembly");
    const links = within(screen.getByRole("list", { name: "Comes from" })).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Bind rod with tape (Truss rod)", "/builds/b1/map/truss-rod"],
      ["Press in frets (Fretboard)", "/builds/b1/map/fretboard"],
      ["Taper thickness thin head (Neck)", "/builds/b1/map/neck"],
    ]);
  });

  it("moves to the neighbouring parts", () => {
    renderFlow("fretboard");
    expect(
      screen.getByRole("link", { name: "Previous part: Truss rod" }).getAttribute("href"),
    ).toBe("/builds/b1/map/truss-rod");
    expect(screen.getByRole("link", { name: "Next part: Neck" }).getAttribute("href")).toBe(
      "/builds/b1/map/neck",
    );
  });

  it("has no previous part before the first", () => {
    renderFlow("truss-rod");
    expect(screen.queryByRole("link", { name: /^Previous part/ })).toBeNull();
  });

  it("has no next part after the last", () => {
    renderFlow("final-assembly");
    expect(screen.queryByRole("link", { name: /^Next part/ })).toBeNull();
  });

  it("draws one connector per arrow inside the part, between the right boxes", () => {
    const { container } = renderFlow("truss-rod");
    const paths = [...container.querySelectorAll("svg[data-connectors] path")];
    expect(paths).toHaveLength(7);
    expect(paths[1]?.getAttribute("d")).toBe("M 46 64 V 78 H 69 V 92");
    expect(container.querySelector("svg[data-connectors]")?.getAttribute("viewBox")).toBe(
      "0 0 100 524",
    );
  });

  it("badges the completed steps, and only those", () => {
    renderFlow("truss-rod", { states: completed("TrussRod", "MakeTrussBlock") });
    const badged = screen
      .getAllByTestId("completion-badge")
      .map((badge) => badge.closest("a")?.getAttribute("aria-label"));
    expect(badged).toEqual([
      "Step 001: Truss rod, Completed",
      "Step 003: Make truss rod stop block, Completed",
    ]);
  });

  it("highlights the construction-variant steps and the bridge blank differently", () => {
    renderFlow("bridge");
    expect(screen.getByRole("link", { name: /Fabricate SS bridge blank/ }).dataset.highlight).toBe(
      "bridgeBlank",
    );
    renderFlow("heel-assembly");
    expect(screen.getByRole("link", { name: /SS fit heel laminate/ }).dataset.highlight).toBe(
      "variant",
    );
    expect(screen.getByRole("link", { name: /Pre-carve heel/ }).dataset.highlight).toBeUndefined();
  });

  it("is in French", () => {
    renderFlow("truss-rod", { locale: "fr" });
    expect(screen.getByRole("heading", { name: "Tige de réglage" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Mène à" })).toBeTruthy();
  });
});
