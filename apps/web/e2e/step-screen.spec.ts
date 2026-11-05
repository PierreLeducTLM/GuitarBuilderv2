// build-sequence: Step Screen, Step Navigation, Step Completion Tracking; guitar-builds:
// Build Views (the step store survives moving between views) and Inaccessible Build Links
// (a variant change hides the open step).
import { expect, type Page, test } from "@playwright/test";
import { en, fakeSupabase, LUTHIER, seedAccounts, signIn } from "./support";

const views = (page: Page) => page.getByRole("navigation", { name: en.builds.views.label });
const stepTitle = (page: Page, name: string) =>
  page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) });

async function seedSteelString() {
  return fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "OM #3",
    guitar_type: "steel_string",
    bobo_neck: false,
  });
}

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("step screen on a desktop", () => {
  test("sits beside the Steps checklist, with the step's row highlighted", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("link", { name: "Step 028: Top panel, Ready" }).first().click();
    await expect(stepTitle(page, "Top panel")).toBeVisible();
    await expect(page.getByRole("region", { name: en.sequence.checklist.label })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Step 028: Top panel, Ready" }).first(),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: en.nav.label, exact: true })).toBeVisible();
  });

  test("completes a step and moves on, and Mark as Incomplete stays", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/TopPanel`);
    await page.getByRole("button", { name: en.sequence.nav.doneNext }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/steps/CutRectangle$`));
    await expect(stepTitle(page, "Cut to rectangle outline")).toBeVisible();

    await page.getByRole("button", { name: en.sequence.nav.previous, exact: true }).click();
    await expect(stepTitle(page, "Top panel")).toBeVisible();
    await page.getByRole("button", { name: en.sequence.markIncomplete }).click();
    await expect(page.getByRole("button", { name: en.sequence.nav.doneNext })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/steps/TopPanel$`));
    await page.reload();
    await expect(page.getByRole("button", { name: en.sequence.nav.doneNext })).toBeVisible();
  });

  test("leaves one history entry however many steps are walked through", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/TrussRod`);
    for (let press = 0; press < 10; press += 1) {
      await page.getByRole("button", { name: en.sequence.nav.next, exact: true }).click();
      await expect(page.getByText(`Step ${press + 2}`, { exact: true })).toBeVisible();
    }
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
  });

  test("returns to the part flow it was opened from", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}/map/top-panel`);
    await page.getByRole("link", { name: /Inlay rosette/ }).click();
    await expect(stepTitle(page, "Inlay rosette")).toBeVisible();
    await page.getByRole("button", { name: en.sequence.nav.next, exact: true }).click();
    await expect(stepTitle(page, "Plane to thickness cut outline")).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("link", { name: en.groups.topPanel, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/map/top-panel$`));
  });

  test("keeps notes typed on a step while moving between views", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/TrussRod`);
    await page.getByLabel(en.sequence.notes).fill("Two wraps of PTFE tape");
    await views(page).getByRole("link", { name: en.builds.views.overview }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/overview$`));
    await views(page).getByRole("link", { name: en.builds.views.steps }).click();
    await page.getByRole("link", { name: "Step 001: Truss rod, Ready" }).first().click();
    await expect(page.getByLabel(en.sequence.notes)).toHaveValue("Two wraps of PTFE tape");
    await expect
      .poll(async () => (await fakeSupabase.builds())[0]?.sequence_state[0]?.notes)
      .toBe("Two wraps of PTFE tape");
  });

  test("leaves a step for the Steps view when a variant change hides it", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/FabricateBridge`);
    await page.getByRole("button", { name: en.builds.actions.more }).click();
    await page.getByRole("menuitem", { name: en.builds.actions.changeConstruction }).click();
    const dialog = page.getByRole("dialog", { name: en.builds.construction.title });
    await dialog.getByRole("radio", { name: en.builds.guitarType.classical }).check();
    await dialog.getByRole("button", { name: en.dialog.save }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
  });
});

test.describe("step screen on a phone @phone", () => {
  test("fills the screen, with its controls at the bottom and no tab bar", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/InlayRosette`);
    await expect(page.getByRole("navigation", { name: en.nav.label, exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: en.sequence.checklist.label })).toBeHidden();
    await expect(page.getByRole("button", { name: en.builds.actions.more })).toBeHidden();
    const controls = page.getByRole("navigation", { name: en.sequence.nav.label });
    const box = await controls.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && Math.round(box.y + box.height)).toBe(viewport?.height);
    await expect(controls.getByRole("button", { name: en.sequence.nav.doneNext })).toBeInViewport();
    await page.getByRole("main").getByRole("link", { name: en.sequence.nav.back }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
    await expect(page.getByRole("navigation", { name: en.nav.label, exact: true })).toBeVisible();
  });
});
