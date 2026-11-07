// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { StoryNotFound } from "./StoryNotFound";

describe("StoryNotFound", () => {
  it("says the build is not found or no longer shared", () => {
    renderWithIntl(<StoryNotFound reason="notFound" />);
    expect(screen.getByRole("heading", { level: 1, name: "Story Not Found" })).toBeTruthy();
    expect(screen.getByText("Build not found or sharing has been disabled.")).toBeTruthy();
    expect(
      screen.getByText(
        "The build story you're looking for might have been removed or the link may be incorrect.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Unable to load this build story.")).toBeNull();
  });

  it("says when the story could not be loaded", () => {
    renderWithIntl(<StoryNotFound reason="error" />);
    expect(screen.getByRole("heading", { level: 1, name: "Story Not Found" })).toBeTruthy();
    expect(screen.getByText("Unable to load this build story.")).toBeTruthy();
    expect(screen.queryByText("Build not found or sharing has been disabled.")).toBeNull();
  });

  it("offers no way into the app", () => {
    renderWithIntl(<StoryNotFound reason="notFound" />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("is in French", () => {
    renderWithIntl(<StoryNotFound reason="notFound" />, { locale: "fr" });
    expect(screen.getByRole("heading", { level: 1, name: "Histoire introuvable" })).toBeTruthy();
    expect(screen.getByText("Fabrication introuvable ou partage désactivé.")).toBeTruthy();
  });
});
