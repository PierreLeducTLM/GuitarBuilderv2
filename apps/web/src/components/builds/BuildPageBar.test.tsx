// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { BuildPageBar } from "./BuildPageBar";

type Props = ComponentProps<typeof BuildPageBar>;

function renderBar(props: Partial<Props> = {}, locale: TestLocale = "en") {
  const handlers = { onDelete: vi.fn(), onChangeConstruction: vi.fn(), onShare: vi.fn() };
  renderWithIntl(
    <BuildPageBar
      name="Build #1"
      createdAt="2025-12-06T15:00:00.000Z"
      variant={{ guitarType: "steel_string", boboNeck: true }}
      canEdit
      deleting={false}
      {...handlers}
      {...props}
    />,
    { locale },
  );
  return handlers;
}

describe("BuildPageBar", () => {
  it("shows the name, the variant and the creation date, with a way back to Builds", () => {
    renderBar();
    expect(screen.getByRole("heading", { level: 1, name: "Build #1" })).toBeTruthy();
    expect(screen.getByText("Steel-string")).toBeTruthy();
    expect(screen.getByText("BOBO neck")).toBeTruthy();
    expect(screen.getByText("Created Dec 6, 2025")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Builds" }).getAttribute("href")).toBe("/builds");
  });

  it("says when the guitar type is not set", () => {
    renderBar({ variant: { guitarType: null, boboNeck: false } });
    expect(screen.getByText("Guitar type not set")).toBeTruthy();
    expect(screen.queryByText("BOBO neck")).toBeNull();
  });

  it("offers Share, Change construction and Delete Build under More actions, not as buttons", async () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Delete Build" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Share",
      "Change construction",
      "Delete Build",
    ]);
  });

  it("opens sharing from the menu", async () => {
    const handlers = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Share" }));
    expect(handlers.onShare).toHaveBeenCalledOnce();
  });

  it("changes the construction and deletes the build from the menu", async () => {
    const handlers = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Change construction" }));
    expect(handlers.onChangeConstruction).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete Build" }));
    expect(handlers.onDelete).toHaveBeenCalledOnce();
  });

  it("does not delete twice while a deletion is running", async () => {
    renderBar({ deleting: true });
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(
      screen.getByRole("menuitem", { name: "Delete Build" }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("has no actions on a read-only build", () => {
    renderBar({ canEdit: false });
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("is in French", async () => {
    renderBar({}, "fr");
    expect(screen.getByRole("link", { name: "Constructions" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Plus d’actions" }));
    expect(screen.getByRole("menuitem", { name: "Modifier la construction" })).toBeTruthy();
  });
});
