import { expect, test } from "@playwright/test";
import { en, fr } from "./support";

const html = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("theme", () => {
  test("defaults to System, which follows the device and its live changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/sign-in");
    await expect(page.getByRole("radio", { name: en.theme.system })).toBeChecked();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
  });

  test("applies a choice immediately and keeps it after reloading", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/sign-in");
    await page.getByRole("radio", { name: en.theme.dark }).check();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("radio", { name: en.theme.dark })).toBeChecked();

    await page.getByRole("radio", { name: en.theme.light }).check();
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "light");
  });

  test("offers the three options with their tooltips", async ({ page }) => {
    await page.goto("/sign-in");
    for (const name of [en.theme.light, en.theme.system, en.theme.dark]) {
      await expect(page.getByTitle(name)).toBeVisible();
    }
  });

  test("is applied before first paint, without waiting for the app's JavaScript", async ({
    page,
  }) => {
    await page.addInitScript(() => window.localStorage.setItem("gb-theme", "dark"));
    await page.emulateMedia({ colorScheme: "light" });
    // Block every script bundle: only the inline head script can set the theme.
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.goto("/sign-in");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(10, 13, 16)");
  });

  test("applies to the public story page", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("gb-theme", "dark"));
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/story/abc123");
    await expect(html(page)).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("language", () => {
  test("starts in English and switches to French without reloading", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(html(page)).toHaveAttribute("lang", "en");
    await expect(page.getByRole("radio", { name: en.language.enName })).toBeChecked();
    await page.evaluate(() => {
      (window as unknown as { marker: number }).marker = 42;
    });

    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(page.getByTestId("auth-subtitle")).toHaveText(fr.auth.subtitleSignIn);
    await expect(page.getByRole("button", { name: fr.auth.signIn, exact: true })).toBeVisible();
    await expect(html(page)).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("radio", { name: fr.language.frName })).toBeChecked();
    // Same document: the switch did not reload the page.
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(42);
  });

  test("keeps the chosen language on later visits", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(page.getByTestId("auth-subtitle")).toHaveText(fr.auth.subtitleSignIn);
    await page.goto("/story/abc123");
    await expect(page.getByRole("heading", { name: fr.story.notFound.title })).toBeVisible();
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(fr.app.documentTitle);
    await expect(page.getByText(fr.auth.note)).toBeVisible();
  });
});
