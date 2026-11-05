// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { SectionPlaceholder } from "./SectionPlaceholder";

describe("SectionPlaceholder", () => {
  it("titles the page with the section's navigation label", () => {
    renderWithIntl(<SectionPlaceholder id="assistant" />);
    expect(screen.getByRole("heading", { level: 1, name: "Assistant" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/This section is being rebuilt/)).toBeTruthy();
  });

  it("returns to Tools from a tool", () => {
    renderWithIntl(<SectionPlaceholder id="simulator" />);
    expect(screen.getByRole("heading", { level: 1, name: "Simulator" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tools" }).getAttribute("href")).toBe("/tools");
  });

  it("has no return control on an admin page", () => {
    renderWithIntl(<SectionPlaceholder id="admin" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
