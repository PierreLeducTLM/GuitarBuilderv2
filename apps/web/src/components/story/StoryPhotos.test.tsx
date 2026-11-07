// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { storyPhoto } from "./fixtures";
import { StoryPhotos } from "./StoryPhotos";

const three = [storyPhoto("1_a.jpg"), storyPhoto("2_b.jpg"), storyPhoto("3_c.jpg")];

function renderPhotos(photos = three, locale: TestLocale = "en") {
  renderWithIntl(<StoryPhotos photos={photos} stepLabel="Join panels" />, { locale });
}

const viewer = () => screen.getByRole("dialog");
const shownPhoto = () => within(viewer()).getByRole("img");

describe("StoryPhotos", () => {
  it("opens the photo that was clicked, full size", async () => {
    renderPhotos();
    await userEvent.click(screen.getByRole("button", { name: "Open photo 2 full screen" }));
    expect(shownPhoto().getAttribute("src")).toBe(storyPhoto("2_b.jpg").url);
    expect(shownPhoto().getAttribute("alt")).toBe("Photo 2 of Join panels");
    expect(within(viewer()).getByText("2 / 3")).toBeTruthy();
  });

  it("goes from the last photo to the first with next", async () => {
    renderPhotos();
    await userEvent.click(screen.getByRole("button", { name: "Open photo 3 full screen" }));
    await userEvent.click(within(viewer()).getByRole("button", { name: "Next photo" }));
    expect(shownPhoto().getAttribute("src")).toBe(storyPhoto("1_a.jpg").url);
    expect(within(viewer()).getByText("1 / 3")).toBeTruthy();
  });

  it("goes from the first photo to the last with previous", async () => {
    renderPhotos();
    await userEvent.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await userEvent.click(within(viewer()).getByRole("button", { name: "Previous photo" }));
    expect(shownPhoto().getAttribute("src")).toBe(storyPhoto("3_c.jpg").url);
    expect(within(viewer()).getByText("3 / 3")).toBeTruthy();
    await userEvent.click(within(viewer()).getByRole("button", { name: "Previous photo" }));
    expect(within(viewer()).getByText("2 / 3")).toBeTruthy();
  });

  it("shows no navigation and no counter for a single photo", async () => {
    renderPhotos([storyPhoto("1_a.jpg")]);
    await userEvent.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    expect(within(viewer()).queryByRole("button", { name: "Next photo" })).toBeNull();
    expect(within(viewer()).queryByRole("button", { name: "Previous photo" })).toBeNull();
    expect(within(viewer()).queryByText("1 / 1")).toBeNull();
  });

  it("closes with the close control or a click outside the photo", async () => {
    renderPhotos();
    await userEvent.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await userEvent.click(within(viewer()).getByRole("button", { name: "Close photo" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open photo 1 full screen" }));
    await userEvent.click(viewer());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is in French", async () => {
    renderPhotos(three, "fr");
    await userEvent.click(
      screen.getByRole("button", { name: "Afficher la photo 1 en plein écran" }),
    );
    expect(within(viewer()).getByRole("button", { name: "Photo suivante" })).toBeTruthy();
    expect(within(viewer()).getByRole("button", { name: "Photo précédente" })).toBeTruthy();
  });
});
