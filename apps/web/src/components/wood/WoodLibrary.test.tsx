// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import type { WoodPanelSummary } from "@/lib/wood/types";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { WoodLibrary } from "./WoodLibrary";

const panel = (overrides: Partial<WoodPanelSummary> = {}): WoodPanelSummary => ({
  id: "p1",
  name: "Sitka #3",
  createdAt: "2026-03-14T10:00:00Z",
  targetThickness: 2.7738,
  estimatedMass: 157.515,
  ...overrides,
});

function renderLibrary(
  panels: WoodPanelSummary[],
  { locale = "en" as "en" | "fr", loadedId = null as string | null } = {},
) {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
      timeZone="UTC"
      formats={formats}
    >
      <WoodLibrary panels={panels} loadedId={loadedId} onOpen={onOpen} onDelete={onDelete} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onDelete };
}

describe("WoodLibrary", () => {
  it("shows each panel's name, date and stored results in the user's locale", () => {
    renderLibrary([panel()], { locale: "fr" });
    const entry = screen.getByRole("listitem");
    expect(entry.textContent).toContain("Sitka #3");
    expect(entry.textContent).toContain("14 mars 2026");
    expect(entry.textContent).toContain(`${fr.wood.library.targetThickness}2,77 mm`);
    expect(entry.textContent).toContain(`${fr.wood.library.estimatedMass}157,5 g`);
  });

  it("omits the estimated mass of an older panel that has none", () => {
    renderLibrary([panel({ estimatedMass: null })]);
    expect(screen.getByRole("listitem").textContent).toContain("2.77 mm");
    expect(screen.queryByText(en.wood.library.estimatedMass)).toBeNull();
  });

  it("marks only the loaded panel as being edited", () => {
    renderLibrary([panel(), panel({ id: "p2", name: "Maple" })], { loadedId: "p2" });
    expect(screen.getAllByText(en.wood.library.currentlyEditing)).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^Maple/ }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^Sitka/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("opens or deletes the panel the user acts on", async () => {
    const maple = panel({ id: "p2", name: "Maple" });
    const { onOpen, onDelete } = renderLibrary([panel(), maple]);
    await userEvent.click(screen.getByRole("button", { name: /^Maple/ }));
    expect(onOpen).toHaveBeenCalledWith(maple);
    await userEvent.click(screen.getByRole("button", { name: "Delete Maple" }));
    expect(onDelete).toHaveBeenCalledWith(maple);
  });
});
