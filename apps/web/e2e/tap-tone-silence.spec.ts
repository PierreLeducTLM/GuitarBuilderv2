// tap-tone-capture end to end: a microphone that hears no tap.
import { expect, test } from "@playwright/test";
import { en, seedAccounts } from "./support";
import { fakeMicrophone, openReader, reader } from "./tap-tone-helpers";

test.use({ launchOptions: fakeMicrophone("silence.wav") });

test.beforeEach(async () => {
  await seedAccounts();
});

test("says no tap was detected after recording silence", async ({ page }) => {
  await openReader(page);
  const dialog = reader(page);
  await dialog.getByRole("button", { name: en.tapTone.capture.start }).click();
  await page.waitForTimeout(2_000);
  await dialog.getByRole("button", { name: en.tapTone.capture.stop }).click();
  await expect(dialog.getByRole("alert")).toHaveText(en.tapTone.errors.noTap, { timeout: 20_000 });
  await expect(dialog.getByRole("button", { name: en.tapTone.capture.start })).toBeVisible();
});
