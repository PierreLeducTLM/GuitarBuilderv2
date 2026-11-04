// tap-tone-capture end to end with audio files: taps, clipping, unsupported files,
// the phone artifact, French and a refused save.
import { expect, test } from "@playwright/test";
import { en, errorToast, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";
import {
  fixture,
  openReader,
  openStep,
  reader,
  storedMeasurements,
  uploadFixture,
  waitForSpectrum,
} from "./tap-tone-helpers";

test.beforeEach(async () => {
  await seedAccounts();
});

test("analyses an uploaded file: three taps, the 190 Hz peak and its note", async ({ page }) => {
  await openReader(page);
  await uploadFixture(page, "taps.wav");
  await waitForSpectrum(page);
  const dialog = reader(page);
  await expect(dialog.getByText("3 of 3 taps used")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^190\.0 Hz \(highest\)$/ })).toBeVisible();
  await expect(dialog.getByRole("region", { name: en.tapTone.detected.heading })).toContainText(
    "190.0",
  );
});

test("rejects the clipped tap and averages the other two", async ({ page }) => {
  await openReader(page);
  await uploadFixture(page, "clipped.wav");
  await waitForSpectrum(page);
  const dialog = reader(page);
  await expect(dialog.getByText("2 of 3 taps used")).toBeVisible();
  await dialog.getByRole("button", { name: "Tap 2" }).hover();
  await expect(page.getByRole("tooltip")).toContainText(en.tapTone.taps.clipped);
});

test("refuses an unsupported file", async ({ page }) => {
  await openReader(page);
  await reader(page)
    .getByLabel(en.tapTone.capture.upload)
    .setInputFiles({ name: "tap.flac", mimeType: "audio/flac", buffer: Buffer.from([0, 1, 2, 3]) });
  await expect(reader(page).getByRole("alert")).toHaveText(en.tapTone.errors.unsupported);
});

test("offers the 134.8 Hz peak on a desktop", async ({ page }) => {
  await openReader(page);
  await uploadFixture(page, "mobile.wav");
  await waitForSpectrum(page);
  await expect(reader(page).getByRole("button", { name: /^134\.\d Hz/ })).toBeVisible();
});

test("drops the 134.8 Hz phone artifact on a phone @phone", async ({ page }) => {
  await openReader(page);
  await uploadFixture(page, "mobile.wav");
  await waitForSpectrum(page);
  const dialog = reader(page);
  await expect(dialog.getByRole("region", { name: en.tapTone.detected.heading })).toContainText(
    "182.",
  );
  await expect(dialog.getByRole("button", { name: /^134\.\d Hz/ })).toHaveCount(0);
});

test("shows the reader in French", async ({ page, context }) => {
  const build = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Lecteur",
    guitar_type: "steel_string",
  });
  await signIn(page, LUTHIER, `/builds/${build.id}`);
  await context.addCookies([{ name: "gb-locale", value: "fr", url: "http://127.0.0.1:3100" }]);
  await page.reload();
  await page.getByRole("tab", { name: fr.builds.detail.tabSequence }).click();
  await openStep(page);
  await page.getByRole("button", { name: fr.sequence.measurement.addAnalysis }).click();
  const dialog = page.getByRole("dialog", { name: fr.tapTone.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: fr.tapTone.capture.start })).toBeVisible();
  await dialog.getByLabel(fr.tapTone.capture.upload).setInputFiles(fixture("body.wav"));
  await expect(dialog.getByRole("img", { name: /^Spectre de fréquences/ })).toBeVisible({
    timeout: 20_000,
  });
  await expect(dialog.getByText(fr.tapTone.roles.top).first()).toBeVisible();
});

test("reports a save the server refuses", async ({ page }) => {
  const build = await openReader(page);
  await uploadFixture(page, "body.wav");
  await waitForSpectrum(page);
  await fakeSupabase.configure({ failStepChanges: true });
  await reader(page).getByRole("button", { name: en.tapTone.actions.confirm }).click();
  const prompt = page.getByRole("dialog", { name: en.sequence.measurement.descriptionLabel });
  await prompt.getByRole("button", { name: en.dialog.save }).click();
  await expect(errorToast(page)).toContainText(en.builds.saveFailed);
  expect(await storedMeasurements(build.id)).toEqual([]);
});
