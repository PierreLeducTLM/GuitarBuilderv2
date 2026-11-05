// wood-panel-properties end to end: the calculator page, its library and the reference panels.
import { expect, type Page, test } from "@playwright/test";
import { ADMIN, en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";

const WOOD = "/wood-properties";

const library = (page: Page) => page.getByRole("region", { name: en.wood.areas.library });
const entries = (page: Page) => library(page).getByRole("listitem");

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("wood panel library", () => {
  test("shows the three areas and lists the user's panels newest first", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({
      ownerEmail: LUTHIER.email,
      name: "A",
      created_at: "2026-03-02T10:00:00Z",
    });
    await fakeSupabase.seedWoodPanel({
      ownerEmail: LUTHIER.email,
      name: "B",
      created_at: "2026-03-03T10:00:00Z",
    });

    await signIn(page, LUTHIER, WOOD);
    await expect(page.getByRole("region", { name: en.wood.areas.inputs })).toBeVisible();
    await expect(page.getByRole("region", { name: en.wood.areas.results })).toBeVisible();
    await expect(entries(page)).toHaveCount(2);
    await expect(entries(page).nth(0)).toContainText("B");
    await expect(entries(page).nth(1)).toContainText("A");
    await expect(entries(page).nth(1)).toContainText("Mar 2, 2026");
    await expect(entries(page).nth(1)).toContainText(`${en.wood.library.targetThickness}2.77 mm`);
    await expect(entries(page).nth(1)).toContainText(`${en.wood.library.estimatedMass}157.5 g`);
  });

  test("says when the library cannot be loaded, without the empty state", async ({ page }) => {
    await fakeSupabase.configure({ failWoodList: true });
    await signIn(page, LUTHIER, WOOD);
    await expect(library(page).getByRole("alert")).toHaveText(en.wood.library.loadFailed);
    await expect(page.getByText(en.wood.library.empty)).toHaveCount(0);
    await expect(page.getByRole("button", { name: en.wood.library.loadDefaults })).toHaveCount(0);
  });

  test("shows an administrator only their own panels", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Maple #1" });
    await fakeSupabase.seedWoodPanel({ ownerEmail: ADMIN.email, name: "Admin's spruce" });
    await signIn(page, ADMIN, WOOD);
    await expect(entries(page)).toHaveCount(1);
    await expect(entries(page)).toContainText("Admin's spruce");
  });
});
