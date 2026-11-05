// wood-panel-properties end to end: the calculator page, its library and the reference panels.
import { expect, type Page, test } from "@playwright/test";
import { ADMIN, en, errorToast, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";

const WOOD = "/wood-properties";

const library = (page: Page) => page.getByRole("region", { name: en.wood.areas.library });
const entries = (page: Page) => library(page).getByRole("listitem");
const inputs = (page: Page) => page.getByRole("region", { name: en.wood.areas.inputs });
const results = (page: Page) => page.getByRole("region", { name: en.wood.areas.results });
const field = (page: Page, key: keyof typeof en.wood.fields) =>
  inputs(page).getByRole("spinbutton", { name: en.wood.fields[key] });

const nameField = (page: Page) =>
  results(page).getByRole("textbox", { name: en.wood.save.nameLabel });
const saveButton = (page: Page) => results(page).getByRole("button", { name: en.wood.save.save });
const updateButton = (page: Page) =>
  results(page).getByRole("button", { name: en.wood.save.update });
const entry = (page: Page, name: string) => entries(page).filter({ hasText: name });
const openEntry = (page: Page, name: string) =>
  entry(page, name)
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
const editing = (page: Page) => library(page).getByText(en.wood.library.currentlyEditing);
const toasts = (page: Page) => page.getByRole("region", { name: en.toast.region });
const deleteDialog = (page: Page) => page.getByRole("dialog", { name: en.wood.deleteDialog.title });

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
    await expect(page.getByRole("button", { name: "Enregistrer le panneau" })).toBeVisible();
  });
});

test.describe("saving and loading panels", () => {
  test("saves a new panel, then loads it back", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleMass").fill("30");
    await expect(nameField(page)).toHaveAttribute("placeholder", en.wood.save.namePlaceholder);
    await nameField(page).fill("  Test Spruce Top  ");
    await saveButton(page).click();

    await expect(toasts(page).getByRole("status")).toContainText(en.wood.save.saved);
    await expect(entries(page).nth(0)).toContainText("Test Spruce Top");
    await expect(nameField(page)).toHaveValue("");
    await expect(editing(page)).toHaveCount(0);
    await expect(field(page, "sampleMass")).toHaveValue("30");
    const [saved] = await fakeSupabase.woodPanels();
    expect(saved).toMatchObject({ name: "Test Spruce Top", sample_mass_g: 30, spectra: {} });

    await field(page, "sampleMass").fill("25");
    await openEntry(page, "Test Spruce Top");
    await expect(field(page, "sampleMass")).toHaveValue("30");
    await expect(nameField(page)).toHaveValue("Test Spruce Top");
    await expect(
      entry(page, "Test Spruce Top").getByText(en.wood.library.currentlyEditing),
    ).toBeVisible();
    await expect(updateButton(page)).toBeVisible();
  });

  test("loads a stored panel with its frequencies rounded to one decimal", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({
      ownerEmail: LUTHIER.email,
      name: "Sitka #3",
      freq_longitudinal_hz: 61.63,
      freq_cross_grain_hz: 105,
    });
    await signIn(page, LUTHIER, WOOD);
    await openEntry(page, "Sitka #3");
    await expect(field(page, "freqLongitudinal")).toHaveValue("61.6");
    await expect(field(page, "freqCrossGrain")).toHaveValue("105.0");
    await expect(field(page, "sampleLength")).toHaveValue("605");
    await expect(results(page).getByText("395.9 kg/m³")).toBeVisible();
  });

  test("updates the loaded panel instead of creating a new one", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await expect(entry(page, "Sitka #3")).toContainText("157.5 g");
    await openEntry(page, "Sitka #3");
    await expect(nameField(page)).toHaveValue("Sitka #3");
    await field(page, "sampleMass").fill("250");
    await updateButton(page).click();

    await expect(toasts(page).getByRole("status")).toContainText(en.wood.save.updated);
    await expect(entry(page, "Sitka #3")).toContainText("172.7 g");
    await expect(nameField(page)).toHaveValue("");
    await expect(editing(page)).toHaveCount(0);
    const panels = await fakeSupabase.woodPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ name: "Sitka #3", sample_mass_g: 250 });
  });

  test("offers saving only with a name", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await expect(saveButton(page)).toBeDisabled();
    await nameField(page).fill("   ");
    await expect(saveButton(page)).toBeDisabled();
    await nameField(page).fill("Sitka");
    await expect(saveButton(page)).toBeEnabled();
    await field(page, "sampleLength").fill("0");
    await expect(nameField(page)).toHaveCount(0);
  });

  test("saves once on a double click, reading Saving... meanwhile", async ({ page }) => {
    await fakeSupabase.configure({ woodSaveDelayMs: 800 });
    await signIn(page, LUTHIER, WOOD);
    await nameField(page).fill("Sitka");
    await saveButton(page).dblclick();
    await expect(results(page).getByRole("button", { name: en.wood.save.saving })).toBeDisabled();
    await expect(toasts(page).getByRole("status")).toContainText(en.wood.save.saved);
    expect(await fakeSupabase.woodPanels()).toHaveLength(1);

    await nameField(page).fill("Maple");
    await results(page)
      .locator("form")
      .evaluate((form: HTMLFormElement) => {
        form.requestSubmit();
        form.requestSubmit();
      });
    await expect(toasts(page).getByRole("status").last()).toContainText(en.wood.save.saved);
    await expect.poll(async () => (await fakeSupabase.woodPanels()).length).toBe(2);
    await page.waitForTimeout(1000);
    expect(await fakeSupabase.woodPanels()).toHaveLength(2);
  });

  test("keeps everything when the save fails", async ({ page }) => {
    await fakeSupabase.configure({ failWoodSave: true });
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleMass").fill("30");
    await nameField(page).fill("Sitka");
    await saveButton(page).click();
    await expect(errorToast(page)).toContainText(en.wood.save.failed);
    await expect(nameField(page)).toHaveValue("Sitka");
    await expect(field(page, "sampleMass")).toHaveValue("30");
    expect(await fakeSupabase.woodPanels()).toHaveLength(0);
  });

  test("deselects the loaded panel on a second click", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await openEntry(page, "Sitka #3");
    await expect(editing(page)).toBeVisible();
    await openEntry(page, "Sitka #3");
    await expect(editing(page)).toHaveCount(0);
    await expect(field(page, "sampleLength")).toHaveValue("280");
    await expect(nameField(page)).toHaveValue("");
  });

  test("resets after loading a panel", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await openEntry(page, "Sitka #3");
    await expect(editing(page)).toBeVisible();
    await inputs(page).getByRole("button", { name: en.wood.reset }).click();
    await expect(field(page, "sampleLength")).toHaveValue("280");
    await expect(nameField(page)).toHaveValue("");
    await expect(editing(page)).toHaveCount(0);
  });

  test("fails to update a panel deleted elsewhere instead of saving a new one", async ({
    page,
  }) => {
    const panel = await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await openEntry(page, "Sitka #3");
    await expect(nameField(page)).toHaveValue("Sitka #3");
    await fakeSupabase.removeWoodPanel(panel.id);
    await updateButton(page).click();
    await expect(errorToast(page)).toContainText(en.wood.save.failed);
    await expect(nameField(page)).toHaveValue("Sitka #3");
    expect(await fakeSupabase.woodPanels()).toHaveLength(0);
  });

  test("says when a panel deleted elsewhere cannot be opened", async ({ page }) => {
    const panel = await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await field(page, "sampleMass").fill("30");
    await fakeSupabase.removeWoodPanel(panel.id);
    await openEntry(page, "Sitka #3");
    await expect(errorToast(page)).toContainText(en.wood.library.loadPanelFailed);
    await expect(field(page, "sampleMass")).toHaveValue("30");
    await expect(editing(page)).toHaveCount(0);
  });
});

test.describe("deleting panels", () => {
  test("deletes a panel after confirmation, and keeps it when cancelled", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Test Spruce Top" });
    await signIn(page, LUTHIER, WOOD);
    const remove = entry(page, "Test Spruce Top").getByRole("button", {
      name: en.wood.library.delete.replace("{name}", "Test Spruce Top"),
    });

    await remove.click();
    await expect(deleteDialog(page)).toContainText(en.wood.deleteDialog.message);
    await deleteDialog(page).getByRole("button", { name: en.dialog.cancel }).click();
    await expect(deleteDialog(page)).toBeHidden();
    expect(await fakeSupabase.woodPanels()).toHaveLength(1);

    await remove.click();
    await deleteDialog(page).getByRole("button", { name: en.wood.deleteDialog.confirm }).click();
    await expect(toasts(page).getByRole("status")).toContainText(en.wood.library.deleted);
    await expect(entry(page, "Test Spruce Top")).toHaveCount(0);
    expect(await fakeSupabase.woodPanels()).toHaveLength(0);
  });

  test("resets the calculator when the loaded panel is deleted", async ({ page }) => {
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Maple" });
    await signIn(page, LUTHIER, WOOD);
    await openEntry(page, "Maple");
    await expect(nameField(page)).toHaveValue("Maple");
    await entry(page, "Sitka #3")
      .getByRole("button", { name: en.wood.library.delete.replace("{name}", "Sitka #3") })
      .click();
    await deleteDialog(page).getByRole("button", { name: en.wood.deleteDialog.confirm }).click();
    await expect(entry(page, "Sitka #3")).toHaveCount(0);
    await expect(nameField(page)).toHaveValue("Maple");

    await entry(page, "Maple")
      .getByRole("button", { name: en.wood.library.delete.replace("{name}", "Maple") })
      .click();
    await deleteDialog(page).getByRole("button", { name: en.wood.deleteDialog.confirm }).click();
    await expect(entries(page)).toHaveCount(0);
    await expect(field(page, "sampleLength")).toHaveValue("280");
    await expect(nameField(page)).toHaveValue("");
  });

  test("says when the panel to delete was already deleted elsewhere", async ({ page }) => {
    const panel = await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await fakeSupabase.removeWoodPanel(panel.id);
    await entry(page, "Sitka #3")
      .getByRole("button", { name: en.wood.library.delete.replace("{name}", "Sitka #3") })
      .click();
    await deleteDialog(page).getByRole("button", { name: en.wood.deleteDialog.confirm }).click();
    await expect(errorToast(page)).toContainText(en.wood.library.deleteFailed);
  });

  test("says when the deletion fails", async ({ page }) => {
    await fakeSupabase.configure({ failWoodDelete: true });
    await fakeSupabase.seedWoodPanel({ ownerEmail: LUTHIER.email, name: "Sitka #3" });
    await signIn(page, LUTHIER, WOOD);
    await entry(page, "Sitka #3")
      .getByRole("button", { name: en.wood.library.delete.replace("{name}", "Sitka #3") })
      .click();
    await deleteDialog(page).getByRole("button", { name: en.wood.deleteDialog.confirm }).click();
    await expect(errorToast(page)).toContainText(en.wood.library.deleteFailed);
    await expect(entry(page, "Sitka #3")).toHaveCount(1);
  });
});

test.describe("default panels", () => {
  const loadDefaults = (page: Page) =>
    library(page).getByRole("button", { name: en.wood.library.loadDefaults });
  const REFERENCES = ["Sitka", "Engelmann", "Lutz", "Western Red Cedar", "European Spruce"];

  test("copies the reference panels into an empty library", async ({ page }) => {
    await fakeSupabase.seedDefaultWoodPanels(
      REFERENCES.map((name, i) => ({ name, created_at: `2026-01-0${i + 1}T10:00:00Z` })),
    );
    await fakeSupabase.configure({ loadDefaultsDelayMs: 800 });
    await signIn(page, LUTHIER, WOOD);
    await expect(library(page).getByText(en.wood.library.empty)).toBeVisible();
    await expect(library(page).getByText(en.wood.library.emptyHint)).toBeVisible();

    await loadDefaults(page).click();
    await expect(
      library(page).getByRole("button", { name: en.wood.library.loadingDefaults }),
    ).toBeDisabled();
    await expect(entries(page)).toHaveCount(5);
    for (const name of REFERENCES) await expect(entry(page, name)).toHaveCount(1);
    await expect(library(page).getByText(en.wood.library.empty)).toHaveCount(0);
    const copies = await fakeSupabase.woodPanels();
    expect(copies).toHaveLength(5);
  });

  test("says when there are no reference panels yet", async ({ page }) => {
    await signIn(page, LUTHIER, WOOD);
    await loadDefaults(page).click();
    await expect(toasts(page).getByRole("status")).toContainText(en.wood.library.noDefaults);
    await expect(library(page).getByText(en.wood.library.empty)).toBeVisible();
    await expect(loadDefaults(page)).toBeEnabled();
  });

  test("says when the copy fails and leaves the library empty", async ({ page }) => {
    await fakeSupabase.seedDefaultWoodPanels([{ name: "Sitka" }]);
    await fakeSupabase.configure({ failLoadDefaults: true });
    await signIn(page, LUTHIER, WOOD);
    await loadDefaults(page).click();
    await expect(errorToast(page)).toContainText(en.wood.library.loadDefaultsFailed);
    await expect(entries(page)).toHaveCount(0);
    await expect(loadDefaults(page)).toBeEnabled();
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
