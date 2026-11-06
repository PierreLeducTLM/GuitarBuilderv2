// wood-panel-properties end to end: measuring the plate with the tap-tone reader in Plate mode,
// from an uploaded recording of three taps at 190.0 Hz.
import { expect, type Page, test } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";
import { reader, uploadFixture, waitForSpectrum } from "./tap-tone-helpers";

const WOOD = "/wood-properties";
const inputs = (page: Page) => page.getByRole("region", { name: en.wood.areas.inputs });
const results = (page: Page) => page.getByRole("region", { name: en.wood.areas.results });
const library = (page: Page) => page.getByRole("region", { name: en.wood.areas.library });
const field = (page: Page, key: keyof typeof en.wood.fields) =>
  inputs(page).getByRole("spinbutton", { name: en.wood.fields[key] });
const frame = (page: Page, key: keyof typeof en.wood.fields) =>
  inputs(page).locator(`[data-field=${key}]`);
const qualityLine = /^Spectral Q \d+ · Decay Q (\d+|—)$/;
type Take = keyof typeof en.tapTone.takes.name;
const takeButton = (page: Page, take: Take) =>
  reader(page)
    .getByRole("group", { name: en.tapTone.takes.label })
    .getByRole("button", { name: new RegExp(`^${en.tapTone.takes.name[take]}`) });
const currentValue = (page: Page, frequency: string) =>
  reader(page).getByText(en.tapTone.main.current.replace("{frequency}", frequency));

async function measure(page: Page, takes: Take[]) {
  await inputs(page).getByRole("button", { name: en.wood.plate.measure }).click();
  await expect(reader(page)).toContainText(en.tapTone.plateLabel);
  for (const take of takes) {
    await takeButton(page, take).click();
    await uploadFixture(page, "taps.wav");
    await waitForSpectrum(page);
    await expect(takeButton(page, take)).toContainText("190.0");
  }
}

const confirm = (page: Page) =>
  reader(page).getByRole("button", { name: en.tapTone.actions.confirm }).click();

test.beforeEach(async () => {
  await seedAccounts();
});

test("writes a measured cross-grain frequency, recalculates and shows its Q", async ({ page }) => {
  await signIn(page, LUTHIER, WOOD);
  await measure(page, ["crossGrain"]);
  await expect(currentValue(page, "90.00")).toBeVisible();
  await confirm(page);
  await expect(reader(page)).toHaveCount(0);
  await expect(field(page, "freqCrossGrain")).toHaveValue("190.0");
  await expect(field(page, "freqLongitudinal")).toHaveValue("180");
  await expect(field(page, "freqDiagonal")).toHaveValue("120");
  await expect(results(page).getByText("E_C = 0.04 GPa")).toBeVisible();
  await expect(frame(page, "freqCrossGrain").getByText(qualityLine)).toBeVisible();
  await expect(inputs(page).getByText(qualityLine)).toHaveCount(1);

  await field(page, "freqCrossGrain").fill("191");
  await expect(inputs(page).getByText(qualityLine)).toHaveCount(0);
});

test("fills two fields measured in one session", async ({ page }) => {
  await signIn(page, LUTHIER, WOOD);
  await measure(page, ["longitudinal", "diagonal"]);
  await confirm(page);
  await expect(field(page, "freqLongitudinal")).toHaveValue("190.0");
  await expect(field(page, "freqDiagonal")).toHaveValue("190.0");
  await expect(field(page, "freqCrossGrain")).toHaveValue("90");
  await expect(inputs(page).getByText(qualityLine)).toHaveCount(2);
});

test("keeps every value when the measurement is cancelled, and offers no current value for an empty field", async ({
  page,
}) => {
  await signIn(page, LUTHIER, WOOD);
  await field(page, "freqLongitudinal").fill("");
  await measure(page, ["longitudinal"]);
  await expect(reader(page).getByText(/^Current value/)).toHaveCount(0);
  await reader(page).getByRole("button", { name: en.tapTone.actions.cancel }).click();
  await expect(reader(page)).toHaveCount(0);
  await expect(field(page, "freqLongitudinal")).toHaveValue("");
  await expect(field(page, "freqCrossGrain")).toHaveValue("90");
  await expect(inputs(page).getByText(qualityLine)).toHaveCount(0);
});

test("saves the measured spectrum and reopens it on the loaded panel", async ({ page }) => {
  test.setTimeout(60_000);
  await signIn(page, LUTHIER, WOOD);
  await measure(page, ["crossGrain"]);
  await confirm(page);
  await results(page).getByRole("textbox", { name: en.wood.save.nameLabel }).fill("Plate");
  await results(page).getByRole("button", { name: en.wood.save.save }).click();
  await expect(library(page).getByRole("listitem")).toHaveCount(1);
  const [saved] = await fakeSupabase.woodPanels();
  expect(Object.keys(saved?.spectra ?? {})).toEqual(["crossGrain"]);
  expect(JSON.stringify(saved?.spectra)).not.toMatch(/spectralQ|decayQ/);

  await page.reload();
  await library(page)
    .getByRole("button", { name: /^Plate/ })
    .click();
  await expect(field(page, "freqCrossGrain")).toHaveValue("190.0");
  await expect(inputs(page).getByText(qualityLine)).toHaveCount(0);

  await inputs(page).getByRole("button", { name: en.wood.plate.measure }).click();
  await takeButton(page, "crossGrain").click();
  await waitForSpectrum(page);
  await expect(takeButton(page, "crossGrain")).toContainText("190.0");

  await takeButton(page, "diagonal").click();
  await expect(reader(page).getByRole("button", { name: en.tapTone.capture.start })).toBeVisible();
  await expect(reader(page).getByRole("img", { name: /^Frequency spectrum/ })).toHaveCount(0);
});
