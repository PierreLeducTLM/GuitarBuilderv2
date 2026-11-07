// microphone-check end to end: Chromium plays body.wav (three taps) as the microphone, so
// this file runs in its own browser.
import { expect, type Page, test } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";
import { fakeMicrophone, openStep, reader } from "./tap-tone-helpers";

test.use({ launchOptions: fakeMicrophone("body.wav") });

test.beforeEach(async () => {
  await seedAccounts();
});

const microphoneCheck = (page: Page) =>
  page.getByRole("dialog", { name: en.microphoneCheck.title });

async function openFromYou(page: Page) {
  await signIn(page, LUTHIER, "/you");
  await page
    .getByRole("region", { name: en.you.microphone })
    .getByRole("button", { name: en.you.checkMicrophone })
    .click();
  await expect(microphoneCheck(page)).toBeVisible();
}

test("checks the microphone from You and shows the result in the Frequency Detector", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openFromYou(page);
  const check = microphoneCheck(page);
  await expect(check.getByText(en.microphoneCheck.notChecked)).toBeVisible();
  await check.getByRole("button", { name: en.microphoneCheck.start }).click();
  await expect(check.getByText(en.microphoneCheck.instruction)).toBeVisible();
  await expect(check.getByRole("heading", { name: en.microphoneCheck.clock.heading })).toBeVisible({
    timeout: 20_000,
  });
  await expect(check.getByText(en.microphoneCheck.clock.accurate)).toBeVisible();
  await expect(
    check.getByRole("heading", { name: en.microphoneCheck.level.heading }),
  ).toBeVisible();
  await expect(check.getByText(/^Last check: .+\. Accurate$/)).toBeVisible();
  await check.getByRole("button", { name: en.dialog.close }).click();
  await expect(microphoneCheck(page)).toHaveCount(0);

  const build = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Reader",
    guitar_type: "steel_string",
    bobo_neck: true,
  });
  await openStep(page, build.id);
  await page.getByRole("button", { name: en.sequence.measurement.addAnalysis }).click();
  await expect(reader(page).getByText(/^Checked .+: Accurate$/)).toBeVisible();
  await reader(page).getByRole("button", { name: en.tapTone.capture.checkInput }).click();
  await expect(microphoneCheck(page).getByText(/^Last check: .+\. Accurate$/)).toBeVisible();
  await microphoneCheck(page).getByRole("button", { name: en.dialog.close }).click();
  await expect(microphoneCheck(page)).toHaveCount(0);
  await expect(reader(page).getByRole("button", { name: en.tapTone.capture.start })).toBeVisible();
});

test.describe("phone @phone", () => {
  test("fills the screen with the Microphone Check", async ({ page }) => {
    await openFromYou(page);
    const box = await microphoneCheck(page).boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box?.x).toBe(0);
    expect(box?.y).toBe(0);
    expect(box?.width).toBe(viewport?.width);
    expect(box?.height).toBe(viewport?.height);
  });
});
