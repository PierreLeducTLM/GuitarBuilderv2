// legacy-data-migration, task 6.2 of legacy-account-and-build-import: after the rehearsal's
// import, the imported luthier signs in with the first-version password and finds the build's
// notes, photos and measurement graph, and the wood panel's saved cross-grain spectrum.
// The ids and credentials are the ones scripts/legacy-import/rehearse.mts seeds.
import { expect, type Page, test } from "@playwright/test";
import { en, signIn } from "../e2e/support";
import { reader } from "../e2e/tap-tone-helpers";

const LUTHIER = { email: "luthier@rehearsal.test", password: "Luthier-pass-2!" };
const BUILD = "e1000000-0000-4000-8000-000000000001";

const inputs = (page: Page) => page.getByRole("region", { name: en.wood.areas.inputs });
const library = (page: Page) => page.getByRole("region", { name: en.wood.areas.library });

test("the imported build shows its notes, photos and measurement graph", async ({ page }) => {
  await signIn(page, LUTHIER, `/builds/${BUILD}/steps/TrussRod`);
  await expect(page.getByLabel(en.sequence.notes)).toHaveValue("Two-way rod, 440 mm\n");
  const photos = page.getByRole("region", { name: en.sequence.photos });
  await expect(photos.getByRole("img")).toHaveCount(2);
  for (const image of await photos.getByRole("img").all()) {
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  }

  await page.goto(`/builds/${BUILD}/steps/TapTestPanels`);
  const sound = page.getByRole("region", { name: en.sequence.soundAnalysis });
  await expect(
    sound.getByRole("img", { name: /^Spectrum of Top tap, peak at 70(\.0)? Hz$/ }),
  ).toBeVisible();
  await expect(sound.getByRole("img", { name: /^Spectrum of Untitled Analysis/ })).toBeVisible();
  await expect(page.getByRole("region", { name: en.sequence.photos }).getByRole("img")).toHaveCount(
    1,
  );
});

test("the imported wood panel reopens its saved cross-grain spectrum", async ({ page }) => {
  await signIn(page, LUTHIER, "/wood-properties");
  await library(page)
    .getByRole("listitem")
    .filter({ hasText: "Sitka #3" })
    .getByRole("button", { name: /^Sitka #3/ })
    .click();
  await expect(
    inputs(page).getByRole("spinbutton", { name: en.wood.fields.freqCrossGrain }),
  ).toHaveValue("57.0");
  await inputs(page).getByRole("button", { name: en.wood.plate.measure }).click();
  const takes = reader(page).getByRole("group", { name: en.tapTone.takes.label });
  await expect(takes.getByRole("button", { name: /^Diagonal.*—$/ })).toBeVisible();
  await takes.getByRole("button", { name: /^Cross-grain.*70\.0 Hz/ }).click();
  const crossGrain = reader(page).getByRole("region", { name: en.wood.fields.freqCrossGrain });
  await expect(crossGrain).toContainText(en.tapTone.main.current.replace("{frequency}", "57.00"));
  await expect(reader(page).getByText(en.tapTone.qReasons.noRecording).first()).toBeVisible();
});
