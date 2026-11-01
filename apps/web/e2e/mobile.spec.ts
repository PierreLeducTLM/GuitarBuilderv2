import { expect, type Page, test } from "@playwright/test";
import { en, fr, LUTHIER, seedAccounts, signIn } from "./support";

const tabBar = (page: Page) => page.getByRole("navigation", { name: en.nav.label }).last();

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("phone layout @phone", () => {
  test("uses a bottom tab bar instead of the header bar", async ({ page }) => {
    await signIn(page, LUTHIER);
    await expect(page.getByText(en.app.subtitle)).toBeHidden();
    await expect(tabBar(page)).toBeVisible();
    await tabBar(page).getByRole("link", { name: en.nav.woodProperties }).click();
    await expect(page).toHaveURL(/\/wood-properties$/);
    await expect(tabBar(page).locator("[aria-current=page]")).toHaveAccessibleName(
      en.nav.woodProperties,
    );

    // The content leaves room for the bar.
    const bar = await tabBar(page).boundingBox();
    const padding = await page
      .locator("main")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(bar?.height ?? Number.POSITIVE_INFINITY);
  });

  test("opens the slide-out menu with the account, sections and preferences", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.shell.openMenu }).click();
    const menu = page.getByRole("dialog", { name: en.shell.menuTitle });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(en.shell.signedInAs)).toBeVisible();
    await expect(menu.getByText(LUTHIER.email)).toBeVisible();
    await expect(menu.getByRole("link")).toHaveText([
      en.nav.builds,
      en.nav.chat,
      en.nav.simulator,
      en.nav.woodProperties,
    ]);
    await expect(menu.getByRole("radio", { name: en.language.frName })).toBeVisible();
    await expect(menu.getByRole("radio", { name: en.theme.dark })).toBeVisible();
    await expect(menu.getByRole("button", { name: en.shell.signOut })).toBeVisible();
    // The page behind is dimmed and does not scroll.
    await expect(page.getByTestId("sheet-backdrop")).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");

    await menu.getByRole("link", { name: en.nav.chat }).click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(menu).toBeHidden();
  });

  test("closes the menu from the close button or the backdrop without navigating", async ({
    page,
  }) => {
    await signIn(page, LUTHIER, "/simulator");
    await page.getByRole("button", { name: en.shell.openMenu }).click();
    await page.getByRole("button", { name: en.shell.closeMenu }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: en.shell.openMenu }).click();
    await page.getByTestId("sheet-backdrop").click({ position: { x: 20, y: 300 } });
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/simulator$/);
  });

  test("changes the language from the menu", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.shell.openMenu }).click();
    await page.getByRole("dialog").getByRole("radio", { name: en.language.frName }).check();
    await expect(
      page.getByRole("dialog").getByRole("button", { name: fr.shell.signOut }),
    ).toBeVisible();
  });

  test("signs out from the menu", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.shell.openMenu }).click();
    await page.getByRole("dialog").getByRole("button", { name: en.shell.signOut }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
