// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { TabBar } from "./TabBar";

const tabs = () =>
  within(screen.getByRole("navigation", { name: "Navigation" })).getAllByRole("link");

describe("TabBar", () => {
  it("offers Builds, Tools, Assistant and You, linking to their destinations", () => {
    renderWithIntl(<TabBar pathname="/builds" />);
    expect(tabs().map((tab) => [tab.textContent, tab.getAttribute("href")])).toEqual([
      ["Builds", "/builds"],
      ["Tools", "/tools"],
      ["Assistant", "/chat"],
      ["You", "/you"],
    ]);
  });

  it("highlights the destination that holds the current URL, and only that one", () => {
    renderWithIntl(<TabBar pathname="/wood-properties" />);
    expect(screen.getByRole("link", { name: "Tools" }).getAttribute("aria-current")).toBe("page");
    expect(tabs().filter((tab) => tab.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("highlights no tab on an admin page", () => {
    renderWithIntl(<TabBar pathname="/admin" />);
    expect(tabs().filter((tab) => tab.hasAttribute("aria-current"))).toHaveLength(0);
  });

  it("is not shown on a step screen", () => {
    renderWithIntl(<TabBar pathname="/builds/7f3c/steps/TopPanel" />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("only treats build step URLs as step screens", () => {
    renderWithIntl(<TabBar pathname="/references/builds/7f3c/steps/TopPanel" />);
    expect(tabs()).toHaveLength(4);
  });

  it("is shown on the other build pages", () => {
    renderWithIntl(<TabBar pathname="/builds/7f3c/map/top-panel" />);
    expect(tabs()).toHaveLength(4);
  });

  it("is labelled in French", () => {
    renderWithIntl(<TabBar pathname="/you" />, { locale: "fr" });
    expect(screen.getByRole("link", { name: "Vous" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Outils" }).getAttribute("href")).toBe("/tools");
  });
});
