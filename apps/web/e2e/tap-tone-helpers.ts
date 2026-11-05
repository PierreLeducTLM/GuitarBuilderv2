import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, type SeedBuild, signIn } from "./support";

export const fixture = (name: string) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

/** Chromium arguments that play a WAV fixture as the microphone. */
export const fakeMicrophone = (name: string) => ({
  executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-audio-capture=${fixture(name)}`,
  ],
});

/** Seeds a build, opens the "Tap test panels" step and its tap-tone reader. */
export async function openReader(page: Page, build: Partial<SeedBuild> = {}) {
  const seeded = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Reader",
    guitar_type: "steel_string",
    bobo_neck: true,
    ...build,
  });
  await signIn(page, LUTHIER, `/builds/${seeded.id}`);
  await openStep(page, seeded.id);
  await page.getByRole("button", { name: en.sequence.measurement.addAnalysis }).click();
  return seeded;
}

/** Opens the "Tap test panels" step screen. */
export async function openStep(page: Page, buildId: string) {
  await page.goto(`/builds/${buildId}/steps/TapTestPanels`);
  await expect(page.locator("article")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

export const reader = (page: Page) => page.getByRole("dialog", { name: en.tapTone.title });

export async function uploadFixture(page: Page, name: string) {
  await reader(page).getByLabel(en.tapTone.capture.upload).setInputFiles(fixture(name));
}

export async function waitForSpectrum(page: Page) {
  await expect(reader(page).getByRole("img", { name: /^Frequency spectrum/ })).toBeVisible({
    timeout: 20_000,
  });
}

export async function storedMeasurements(buildId: string) {
  const build = (await fakeSupabase.builds()).find((candidate) => candidate.id === buildId);
  return build?.sequence_state.find((entry) => entry.key === "TapTestPanels")?.measurements ?? [];
}
