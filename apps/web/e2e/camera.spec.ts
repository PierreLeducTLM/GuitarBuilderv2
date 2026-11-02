// build-sequence: Step Photo Upload, the Camera button on a device with a camera. Runs
// in its own file because it needs a browser started with a (fake) camera.
import { expect, test } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";

test.use({
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.beforeEach(async () => {
  await seedAccounts();
});

test("offers the Camera button on a device with a camera", async ({ page }) => {
  const build = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Camera",
    guitar_type: "classical",
  });
  await signIn(page, LUTHIER, `/builds/${build.id}`);
  await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
  await page.locator("[data-step=JoinPanels]").click();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog.getByRole("button", { name: en.sequence.photo.camera })).toBeVisible();
  await expect(dialog.getByTestId("camera-input")).toHaveAttribute("capture", "environment");
  await expect(dialog.getByTestId("camera-input")).toHaveAttribute("accept", "image/*");
});
