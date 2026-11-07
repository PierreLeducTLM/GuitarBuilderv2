// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StepState } from "@/lib/sequence/state";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { stepState, storyMeasurement, storyPhoto } from "./fixtures";
import { StoryStepCard } from "./StoryStepCard";

function renderCard(state: StepState, locale: TestLocale = "en") {
  return renderWithIntl(<StoryStepCard step={{ key: "JoinPanels", number: 4, state }} />, {
    locale,
  });
}

describe("StoryStepCard", () => {
  it("shows the step's notes, photos and sound analysis", () => {
    renderCard(
      stepState({
        notes: "Glued with hide glue.\nClamped overnight.",
        photos: [storyPhoto("1_a.jpg"), storyPhoto("2_b.jpg")],
        measurements: [storyMeasurement()],
      }),
    );
    expect(screen.getByRole("heading", { name: "Join panels" })).toBeTruthy();
    expect(screen.getByText("Step 4")).toBeTruthy();
    expect(screen.getByLabelText("Completed")).toBeTruthy();

    const notes = screen.getByRole("region", { name: "Notes" });
    const text = within(notes).getByText(/Glued with hide glue/);
    expect(text.textContent).toBe("Glued with hide glue.\nClamped overnight.");
    expect(text.className).toContain("whitespace-pre-line");

    const photos = screen.getByRole("region", { name: "2 Photos" });
    expect(
      within(photos)
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt")),
    ).toEqual(["Photo 1 of Join panels", "Photo 2 of Join panels"]);
    expect(
      within(photos)
        .getAllByRole("img")
        .map((img) => img.getAttribute("src")),
    ).toEqual([storyPhoto("1_a.jpg").url, storyPhoto("2_b.jpg").url]);

    const analysis = screen.getByRole("region", { name: "Sound Analysis (1)" });
    expect(within(analysis).getByText("Top tap")).toBeTruthy();
    expect(within(analysis).getByText("Peak: 187.4 Hz")).toBeTruthy();
    expect(within(analysis).getByText("Dec 8, 2025, 2:05 PM")).toBeTruthy();
    expect(
      within(analysis).getByRole("img", { name: "Spectrum of Top tap, peak at 187.4 Hz" }),
    ).toBeTruthy();
  });

  it("counts a single photo in the singular", () => {
    renderCard(stepState({ photos: [storyPhoto("1_a.jpg")] }));
    expect(screen.getByRole("region", { name: "1 Photo" })).toBeTruthy();
  });

  it("shows the peak with one decimal", () => {
    renderCard(stepState({ measurements: [storyMeasurement({ frequency: 98 })] }));
    expect(screen.getByText("Peak: 98.0 Hz")).toBeTruthy();
  });

  it("leaves out the sections a step has nothing for", () => {
    renderCard(stepState({ notes: "  \n ", photos: [storyPhoto("1_a.jpg")] }));
    expect(screen.queryByRole("region", { name: "Notes" })).toBeNull();
    expect(screen.queryByRole("region", { name: /Sound Analysis/ })).toBeNull();
    expect(screen.getByRole("region", { name: "1 Photo" })).toBeTruthy();
  });

  it("leaves out photos when there are none", () => {
    renderCard(stepState({ notes: "Glued." }));
    expect(screen.queryByRole("region", { name: /Photo/ })).toBeNull();
    expect(screen.getByRole("region", { name: "Notes" })).toBeTruthy();
  });

  it("is in French", () => {
    renderCard(
      stepState({
        photos: [storyPhoto("1_a.jpg"), storyPhoto("2_b.jpg")],
        measurements: [storyMeasurement()],
      }),
      "fr",
    );
    expect(screen.getByText("Étape 4")).toBeTruthy();
    expect(screen.getByRole("region", { name: "2 photos" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Analyse sonore (1)" })).toBeTruthy();
    expect(screen.getByText("Pic : 187,4 Hz")).toBeTruthy();
  });
});
