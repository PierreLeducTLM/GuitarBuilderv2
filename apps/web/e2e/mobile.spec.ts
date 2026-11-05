import { expect, type Page, test } from "@playwright/test";
import { ADMIN, en, fr, LUTHIER, seedAccounts, signIn } from "./support";

const tabBar = (page: Page) => page.getByRole("navigation", { name: en.nav.label });

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("phone layout @phone", () => {
  test("uses a four-tab bottom bar as the only navigation", async ({ page }) => {
    await signIn(page, ADMIN);
    await expect(page.getByRole("complementary")).toBeHidden();
    await expect(tabBar(page)).toBeVisible();
    await expect(tabBar(page).getByRole("link")).toHaveText([
      en.nav.builds,
      en.nav.tools,
      en.nav.assistant,
      en.nav.you,
    ]);
    await expect(page.getByRole("button", { name: /menu/i })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("goes to a tool through Tools and back, keeping Tools highlighted", async ({ page }) => {
    await signIn(page, LUTHIER);
    await tabBar(page).getByRole("link", { name: en.nav.tools }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(en.nav.woodPanels) })
      .click();
    await expect(page).toHaveURL(/\/wood-properties$/);
    await expect(tabBar(page).locator("[aria-current=page]")).toHaveAccessibleName(en.nav.tools);
    await page.getByRole("main").getByRole("link", { name: en.nav.tools }).click();
    await expect(page).toHaveURL(/\/tools$/);
  });

  test("leaves room under long pages for the bar", async ({ page }) => {
    await signIn(page, LUTHIER, "/wood-properties");
    const bar = await tabBar(page).boundingBox();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = page.getByRole("main").locator(":scope > *").last();
    const box = await last.boundingBox();
    expect(bar).not.toBeNull();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0);
  });

  test("reaches the account, preferences, admin areas and sign-out under You", async ({ page }) => {
    await signIn(page, ADMIN);
    await tabBar(page).getByRole("link", { name: en.nav.you }).click();
    await expect(page).toHaveURL(/\/you$/);
    await expect(page.getByRole("main").getByText(ADMIN.email)).toBeVisible();
    await expect(page.getByRole("radio", { name: en.theme.dark })).toBeVisible();
    await expect(
      page.getByRole("region", { name: en.you.administration }).getByRole("link"),
    ).toHaveText([en.nav.references, en.nav.admin]);

    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(tabBar(page).getByRole("link", { name: fr.nav.you })).toBeVisible();
    await page.getByRole("button", { name: fr.shell.signOut }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("shows no Administration group to a regular user", async ({ page }) => {
    await signIn(page, LUTHIER, "/you");
    await expect(page.getByRole("region", { name: en.you.administration })).toHaveCount(0);
  });
});
