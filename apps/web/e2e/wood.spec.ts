// wood-panel-properties end to end: the calculator page, its library and the reference panels.
import { expect, type Page, test } from "@playwright/test";
import { ADMIN, en, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";

const WOOD = "/wood-properties";

const library = (page: Page) => page.getByRole("region", { name: en.wood.areas.library });
const entries = (page: Page) => library(page).getByRole("listitem");
const inputs = (page: Page) => page.getByRole("region", { name: en.wood.areas.inputs });
const results = (page: Page) => page.getByRole("region", { name: en.wood.areas.results });
const field = (page: Page, key: keyof typeof en.wood.fields) =>
  inputs(page).getByRole("spinbutton", { name: en.wood.fields[key] });

async function useFrench(page: Page) {
  await page
    .context()
    .addCookies([{ name: "gb-locale", value: "fr", url: "http://127.0.0.1:3100" }]);
}

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

test.describe("wood calculator", () => {
  test("opens on the default inputs and their results", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    for (const group of Object.values(en.wood.groups)) {
      await expect(inputs(page).getByRole("group", { name: group })).toBeVisible();
    }
    const expected = {
      sampleLength: "280",
      sampleWidth: "70",
      sampleThickness: "3.0",
      sampleMass: "25",
      freqLongitudinal: "180",
      freqCrossGrain: "90",
      freqDiagonal: "120",
      plateLength: "500",
      plateWidth: "380",
      stiffness: "75",
    } as const;
    for (const [key, value] of Object.entries(expected)) {
      await expect(field(page, key as keyof typeof expected)).toHaveValue(value);
      await expect(field(page, key as keyof typeof expected)).toHaveAttribute("step", "0.1");
    }
    await expect(inputs(page).getByText(en.wood.hints.stiffness)).toBeVisible();
    await expect(field(page, "sampleMass")).toHaveAccessibleName(/Sample Mass \(m\) g$/);

    await expect(results(page).getByText("425.2 kg/m³")).toBeVisible();
    await expect(results(page).getByText("E_L = 8.86 GPa")).toBeVisible();
    await expect(results(page).getByText("E_C = 0.01 GPa")).toBeVisible();
    await expect(results(page).getByText("G_LC = 0.32 GPa")).toBeVisible();
    await expect(results(page).getByText("3.72 mm")).toBeVisible();
    await expect(results(page).getByText("227.0 g")).toBeVisible();
  });

  test("recalculates as the user types", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleLength").fill("300");
    await field(page, "sampleWidth").fill("80");
    await field(page, "sampleThickness").fill("3.5");
    await field(page, "sampleMass").fill("30");
    await expect(results(page).getByText("357.1 kg/m³")).toBeVisible();
  });

  test("hides the results while an input is invalid, and shows them again once fixed", async ({
    page,
  }) => {
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleLength").fill("0");
    await expect(inputs(page).getByText(en.wood.validation.sampleLength)).toBeVisible();
    await expect(field(page, "sampleLength")).toHaveAttribute("aria-invalid", "true");
    await expect(results(page).getByText(en.wood.results.fixInputs)).toBeVisible();
    await expect(results(page).getByText(/kg\/m³/)).toHaveCount(0);

    await field(page, "stiffness").fill("-5");
    await expect(inputs(page).getByText(en.wood.validation.stiffness)).toBeVisible();
    await field(page, "sampleMass").fill("");
    await expect(inputs(page).getByText(en.wood.validation.sampleMass)).toBeVisible();

    await field(page, "sampleLength").fill("300");
    await field(page, "stiffness").fill("75");
    await field(page, "sampleMass").fill("25");
    await expect(inputs(page).getByText(en.wood.validation.sampleLength)).toHaveCount(0);
    await expect(field(page, "sampleLength")).not.toHaveAttribute("aria-invalid");
    await expect(results(page).getByText(/kg\/m³/)).toBeVisible();
  });

  test("resets every input to its default", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleLength").fill("0");
    await field(page, "plateWidth").fill("400");
    await inputs(page).getByRole("button", { name: en.wood.reset }).click();
    await expect(field(page, "sampleLength")).toHaveValue("280");
    await expect(field(page, "plateWidth")).toHaveValue("380");
    await expect(results(page).getByText("425.2 kg/m³")).toBeVisible();
  });

  test("is in French for a French user", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await useFrench(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mesures d'entrée" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: fr.wood.fields.sampleLength })).toHaveValue(
      "280",
    );
    await expect(page.getByText("425,2 kg/m³")).toBeVisible();
  });
});

test.describe("wood calculator on a phone @phone", () => {
  test("stacks the inputs, the results and the library", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    const top = async (region: ReturnType<typeof inputs>) => (await region.boundingBox())?.y ?? 0;
    const [inputsTop, resultsTop, libraryTop] = [
      await top(inputs(page)),
      await top(results(page)),
      await top(library(page)),
    ];
    expect(inputsTop).toBeLessThan(resultsTop);
    expect(resultsTop).toBeLessThan(libraryTop);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  });
});
