// tap-tone-capture end to end with a microphone: Chromium plays body.wav (three taps of an
// assembled body) as the microphone, so this file runs in its own browser.
import { expect, test } from "@playwright/test";
import { en, seedAccounts } from "./support";
import {
  fakeMicrophone,
  openReader,
  reader,
  storedMeasurements,
  waitForSpectrum,
} from "./tap-tone-helpers";

test.use({ launchOptions: fakeMicrophone("body.wav") });

test.beforeEach(async () => {
  await seedAccounts();
});

test("records taps on a build step, labels the body, moves Top and saves the analysis", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const build = await openReader(page);
  const dialog = reader(page);
  await dialog.getByRole("button", { name: en.tapTone.capture.start }).click();
  await expect(dialog.getByText(en.tapTone.capture.recording)).toBeVisible();
  await page.waitForTimeout(6_500);
  await dialog.getByRole("button", { name: en.tapTone.capture.stop }).click();
  await waitForSpectrum(page);

  const roles = dialog.locator("section", {
    has: page.getByRole("heading", { name: en.tapTone.rolesPanel.heading }),
  });
  await expect(roles.getByRole("listitem").nth(0)).toContainText(/9[78]\.\d Hz/);
  await expect(roles.getByRole("listitem").nth(1)).toContainText(/19[67]\.\d Hz/);
  await expect(roles.getByRole("listitem").nth(2)).toContainText(/24[78]\.\d Hz/);

  const topLabel = dialog.locator("[data-role=top]");
  const backPeak = dialog
    .locator("[data-peak]", { hasText: /^24[78]\.\d Hz$/ })
    .locator("circle")
    .last();
  const from = await topLabel.boundingBox();
  const to = await backPeak.boundingBox();
  if (!from || !to) throw new Error("expected the Top label and the Back peak on screen");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(roles.getByRole("listitem").nth(1)).toContainText(en.tapTone.rolesPanel.setByYou);

  await dialog.getByRole("button", { name: en.tapTone.actions.confirm }).click();
  const prompt = page.getByRole("dialog", { name: en.sequence.measurement.descriptionLabel });
  await expect(prompt.getByRole("textbox")).toHaveValue(en.sequence.measurement.defaultDescription);
  await prompt.getByRole("textbox").fill("Box closed");
  await prompt.getByRole("button", { name: en.dialog.save }).click();
  await expect.poll(async () => (await storedMeasurements(build.id)).length).toBe(1);

  await page.reload();
  await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
  await page.locator("[data-step=TapTestPanels]").click();
  const entry = page.locator("[data-measurement]").first();
  await expect(entry).toContainText("Box closed");
  await expect(entry.locator("[data-roles]")).toContainText(/Air 9[78]\.\d Hz · Top 24[78]\.\d Hz/);
  const [stored] = await storedMeasurements(build.id);
  expect(Object.keys(stored?.roles ?? {}).sort()).toEqual(["air", "back", "top"]);
  expect(stored?.roles?.back?.origin).toBe("auto");
  expect(stored?.roles?.top?.origin).toBe("user");
});

test("discards a recording that is cancelled", async ({ page }) => {
  const build = await openReader(page);
  const dialog = reader(page);
  await dialog.getByRole("button", { name: en.tapTone.capture.start }).click();
  await expect(dialog.getByText(en.tapTone.capture.recording)).toBeVisible();
  await dialog.getByRole("button", { name: en.tapTone.actions.cancel }).click();
  await expect(reader(page)).toHaveCount(0);
  expect(await storedMeasurements(build.id)).toEqual([]);
});
