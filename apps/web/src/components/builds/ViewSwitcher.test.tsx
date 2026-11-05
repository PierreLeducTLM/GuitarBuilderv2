// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { ViewSwitcher } from "./ViewSwitcher";

const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("ViewSwitcher", () => {
  it("links Steps, Map and Overview to their URLs", () => {
    renderWithIntl(<ViewSwitcher buildId="b1" pathname="/builds/b1" />);
    const nav = screen.getByRole("navigation", { name: "Build views" });
    expect(
      [...nav.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Steps", "/builds/b1"],
      ["Map", "/builds/b1/map"],
      ["Overview", "/builds/b1/overview"],
    ]);
  });

  it.each([
    ["/builds/b1", "Steps"],
    ["/builds/b1/steps/TopPanel", "Steps"],
    ["/builds/b1/map", "Map"],
    ["/builds/b1/map/top-panel", "Map"],
    ["/builds/b1/overview", "Overview"],
  ])("on %s marks %s as the current view", (pathname, view) => {
    renderWithIntl(<ViewSwitcher buildId="b1" pathname={pathname} />);
    expect(current()).toEqual([view]);
  });

  it("is in French", () => {
    renderWithIntl(<ViewSwitcher buildId="b1" pathname="/builds/b1/map" />, { locale: "fr" });
    expect(screen.getByRole("navigation", { name: "Vues de la fabrication" })).toBeTruthy();
    expect(current()).toEqual(["Carte"]);
  });
});
