import { expect, test } from "@playwright/test";
import { en } from "./support";

test.describe("access gate without a session", () => {
  test("shows the sign-in screen and keeps the requested URL", async ({ page }) => {
    await page.goto("/builds");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fbuilds$/);
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);

    await page.goto("/chat?thread=7");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fchat%3Fthread%3D7$/);
  });

  test("gates admin and unknown URLs too", async ({ page }) => {
    for (const path of ["/admin", "/references", "/does-not-exist", "/builds/7f3c-example"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}$`));
    }
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("serves the public story page without the sign-in screen or the shell", async ({ page }) => {
    await page.goto("/story/abc123");
    await expect(page).toHaveURL(/\/story\/abc123$/);
    await expect(page.getByRole("heading", { name: en.story.title })).toBeVisible();
    await expect(page.getByText("abc123")).toBeVisible();
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});
