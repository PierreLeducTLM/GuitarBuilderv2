// build-sequence: Part Flow Layout — every part flow fits a 360 px screen.
import { expect, test } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";

const GROUP_KEYS = [
  "truss-rod",
  "fretboard",
  "neck",
  "top-panel",
  "braces",
  "back-panel",
  "sides",
  "end-blocks",
  "bridge",
  "nut-saddle",
  "neck-assembly",
  "body-finish",
  "heel-assembly",
  "body-assembly",
  "final-assembly",
];

test.use({ viewport: { width: 360, height: 740 } });

test.beforeEach(async () => {
  await seedAccounts();
});

test("every part flow fits a 360 px screen without scrolling sideways or zooming", async ({
  page,
}) => {
  const build = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Everything shown",
    guitar_type: null,
    bobo_neck: true,
  });
  await signIn(page, LUTHIER, `/builds/${build.id}/map`);
  for (const key of GROUP_KEYS) {
    await page.goto(`/builds/${build.id}/map/${key}`);
    const steps = page.getByRole("list", { name: /^Steps of / }).getByRole("link");
    await expect(steps.first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, key).toBeLessThanOrEqual(0);
    for (const box of await steps.all()) {
      const fits = await box.evaluate((element) => {
        const label = element.querySelector(".line-clamp-2") as HTMLElement;
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.right <= window.innerWidth &&
          label.scrollWidth <= label.clientWidth + 1 &&
          rect.width >= 90
        );
      });
      expect(fits, `${key}: ${await box.getAttribute("aria-label")}`).toBe(true);
    }
  }
  await page.goto(`/builds/${build.id}/map/body-finish`);
  await expect(page.getByRole("heading", { name: en.groups.bodyFinish })).toBeVisible();
  await page.screenshot({ path: "test-results/body-finish-flow.png", fullPage: true });
});
