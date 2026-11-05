// guitar-builds: Build Views, Build Deep Links, Inaccessible Build Links and the build's
// page bar (Build Detail Header).
import { expect, type Page, test } from "@playwright/test";
import { en, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";

const views = (page: Page) => page.getByRole("navigation", { name: en.builds.views.label });

async function seedSteelString(name = "OM #3") {
  return fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name,
    guitar_type: "steel_string",
    bobo_neck: false,
  });
}

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("build views", () => {
  test("open on Steps, switch to Map and Overview by URL, and go back", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await expect(views(page).getByRole("link", { name: en.builds.views.steps })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await views(page).getByRole("link", { name: en.builds.views.map }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/map$`));
    await views(page).getByRole("link", { name: en.builds.views.overview }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/overview$`));
    await expect(page.getByRole("heading", { name: en.builds.construction.title })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/map$`));
    await expect(views(page).getByRole("link", { name: en.builds.views.map })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keep the view after a reload", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}/overview`);
    await page.reload();
    await expect(views(page).getByRole("link", { name: en.builds.views.overview })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("link Next up to the step's own URL", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("link", { name: /Next up: Truss rod/ }).click();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}/steps/TrussRod$`));
  });

  test("are labelled in French", async ({ page, context }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await context.addCookies([{ name: "gb-locale", value: "fr", url: "http://127.0.0.1:3100" }]);
    await page.reload();
    const nav = page.getByRole("navigation", { name: fr.builds.views.label });
    await expect(nav.getByRole("link")).toHaveText([
      fr.builds.views.steps,
      fr.builds.views.map,
      fr.builds.views.overview,
    ]);
  });
});

test.describe("build links", () => {
  test("open a step directly", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.goto(`/builds/${build.id}/steps/FitTopBack`);
    await expect(page.getByRole("heading", { level: 2, name: "Fit top and back" })).toBeVisible();
    await expect(page.getByText("Step 115")).toBeVisible();
  });

  for (const [what, path] of [
    ["an unknown step key", "steps/NoSuchStep"],
    ["a step the variant hides", "steps/FabricateCLBridge"],
    ["an unknown group", "map/no-such-group"],
  ] as const) {
    test(`lead to the Steps view for ${what}`, async ({ page }) => {
      const build = await seedSteelString();
      await signIn(page, LUTHIER, `/builds/${build.id}`);
      await page.goto(`/builds/${build.id}/${path}`);
      await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
    });
  }
});

test.describe("build page bar", () => {
  test("keeps the actions in More actions and returns to Builds", async ({ page }) => {
    const build = await seedSteelString();
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await expect(page.getByRole("button", { name: en.builds.detail.delete })).toHaveCount(0);
    await page.getByRole("button", { name: en.builds.actions.more }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      en.builds.detail.share,
      en.builds.actions.changeConstruction,
      en.builds.detail.delete,
    ]);
    await page.getByRole("menuitem", { name: en.builds.actions.changeConstruction }).click();
    await expect(page.getByRole("dialog", { name: en.builds.construction.title })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("main").getByRole("link", { name: en.nav.builds, exact: true }).click();
    await expect(page).toHaveURL(/\/builds$/);
  });
});

test.describe("recent builds", () => {
  test("move a build to the top of the sidebar once one of its steps is saved", async ({
    page,
  }) => {
    const older = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Older",
      guitar_type: "classical",
      updated_at: "2026-10-01T12:00:00.000Z",
    });
    await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Newer",
      guitar_type: "classical",
      updated_at: "2026-10-02T12:00:00.000Z",
    });
    const recent = page
      .getByRole("complementary")
      .getByRole("list", { name: en.nav.recentBuilds })
      .getByRole("link");
    await signIn(page, LUTHIER, `/builds/${older.id}`);
    await expect(recent).toHaveText(["Newer", "Older"]);

    await page.goto(`/builds/${older.id}/steps/TrussRod`);
    await page.getByRole("button", { name: en.sequence.nav.doneNext }).click();
    await expect(recent).toHaveText(["Older", "Newer"]);
  });
});
