// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ToolsScreen } from "./ToolsScreen";

const toolLinks = () =>
  screen.getAllByRole("link").map((link) => [link.getAttribute("href"), link.textContent]);

describe("ToolsScreen", () => {
  it("is a top-level page titled Tools, without a return control", () => {
    renderWithIntl(<ToolsScreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Tools" })).toBeTruthy();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/wood-properties",
      "/simulator",
    ]);
  });

  it("lists Wood panels then Simulator, each with its one-line description", () => {
    renderWithIntl(<ToolsScreen />);
    expect(toolLinks()).toEqual([
      [
        "/wood-properties",
        "Wood panelsDensity, stiffness and target thickness of a top or back from sample measurements.",
      ],
      ["/simulator", "SimulatorSee how body and plate choices change the guitar’s response."],
    ]);
  });

  it("is in French", () => {
    renderWithIntl(<ToolsScreen />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 1, name: "Outils" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Panneaux de bois/ }).getAttribute("href")).toBe(
      "/wood-properties",
    );
  });
});
