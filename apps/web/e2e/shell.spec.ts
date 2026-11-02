import { expect, type Page, test } from "@playwright/test";
import {
  ADMIN,
  en,
  errorToast,
  fakeSupabase,
  fillCredentials,
  formAlert,
  fr,
  LUTHIER,
  seedAccounts,
  signIn,
} from "./support";

const mainNav = (page: Page) =>
  page.getByRole("banner").getByRole("navigation", { name: en.nav.label });

async function navLabels(page: Page) {
  return mainNav(page).getByRole("link").allTextContents();
}

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("signing in", () => {
  test("returns to the requested section", async ({ page }) => {
    await signIn(page, LUTHIER, "/chat");
    await expect(page.getByRole("heading", { level: 1, name: en.nav.chat })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: en.nav.chat })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("never follows a next parameter that leaves the site", async ({ page }) => {
    await page.goto("/sign-in?next=https://evil.example/");
    await fillCredentials(page, LUTHIER.email, LUTHIER.password);
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3100\/builds$/);
  });

  test("shows the service's reason and keeps the form filled on failure", async ({ page }) => {
    await page.goto("/sign-in");
    await fillCredentials(page, LUTHIER.email, "wrong-password");
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(formAlert(page)).toHaveText(en.auth.errors.service.invalid_credentials);
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByLabel(en.auth.email, { exact: true })).toHaveValue(LUTHIER.email);
    await expect(page.getByLabel(en.auth.password, { exact: true })).toHaveValue("wrong-password");
  });

  test("disables the form while the request is pending", async ({ page }) => {
    await fakeSupabase.configure({ signInDelayMs: 1500 });
    await page.goto("/sign-in");
    await fillCredentials(page, LUTHIER.email, LUTHIER.password);
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    const pending = page.getByRole("button", { name: en.auth.pleaseWait });
    await expect(pending).toBeDisabled();
    await expect(page.getByLabel(en.auth.email, { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: en.auth.switchToSignUp })).toBeDisabled();
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("reports an unexpected failure and enables the form again", async ({ page }) => {
    await fakeSupabase.configure({ failSignIn: true });
    await page.goto("/sign-in");
    await fillCredentials(page, LUTHIER.email, LUTHIER.password);
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(formAlert(page)).toHaveText(en.auth.errors.unexpected);
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeEnabled();
  });

  test("restores the session after a reload", async ({ page }) => {
    await signIn(page, LUTHIER, "/simulator");
    await page.reload();
    await expect(page).toHaveURL(/\/simulator$/);
    await expect(page.getByRole("heading", { level: 1, name: en.nav.simulator })).toBeVisible();
  });
});

test.describe("signing up", () => {
  test("signs the first account in at once when verification is off, as administrator", async ({
    page,
  }) => {
    await fakeSupabase.reset();
    await page.goto("/sign-in");
    await page.getByRole("button", { name: en.auth.switchToSignUp }).click();
    await fillCredentials(page, "new@example.com", "maple456");
    await page.getByLabel(en.auth.confirmPassword, { exact: true }).fill("maple456");
    await page.getByRole("button", { name: en.auth.signUp, exact: true }).click();
    await expect(page).toHaveURL(/\/builds$/);
    await expect(mainNav(page).getByRole("link", { name: en.nav.admin })).toBeVisible();
  });

  test("asks to verify the email when verification is on", async ({ page }) => {
    await fakeSupabase.configure({ requireConfirmation: true });
    await page.goto("/sign-in");
    await page.getByRole("button", { name: en.auth.switchToSignUp }).click();
    await fillCredentials(page, "new@example.com", "maple456");
    await page.getByLabel(en.auth.confirmPassword, { exact: true }).fill("maple456");
    await page.getByRole("button", { name: en.auth.signUp, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: en.auth.signUpSuccess })).toBeVisible();
    await expect(page.getByLabel(en.auth.email, { exact: true })).toHaveValue("");
    await expect(page.getByLabel(en.auth.password, { exact: true })).toHaveValue("");
    await expect(page.getByLabel(en.auth.confirmPassword, { exact: true })).toHaveValue("");

    await page.getByRole("button", { name: en.auth.switchToSignIn }).click();
    await fillCredentials(page, "new@example.com", "maple456");
    await page.getByRole("button", { name: en.auth.signIn, exact: true }).click();
    await expect(formAlert(page)).toHaveText(en.auth.errors.service.email_not_confirmed);
  });
});

test.describe("navigation", () => {
  test("lists the four regular sections for a user, with icons", async ({ page }) => {
    await signIn(page, LUTHIER);
    expect(await navLabels(page)).toEqual([
      en.nav.builds,
      en.nav.chat,
      en.nav.simulator,
      en.nav.woodProperties,
    ]);
    await expect(mainNav(page).locator("svg")).toHaveCount(4);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test("moves between sections and highlights the active one", async ({ page }) => {
    await signIn(page, LUTHIER);
    await mainNav(page).getByRole("link", { name: en.nav.simulator }).click();
    await expect(page).toHaveURL(/\/simulator$/);
    await expect(page.getByRole("heading", { level: 1, name: en.nav.simulator })).toBeVisible();
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveText(en.nav.simulator);
  });

  test("highlights Builds for a build detail URL", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Highlighted",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Highlighted" })).toBeVisible();
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveCount(1);
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveText(en.nav.builds);
  });

  test("redirects unknown URLs to Builds without a history entry", async ({ page }) => {
    await signIn(page, LUTHIER, "/chat");
    await page.goto("/does-not-exist");
    await expect(page).toHaveURL(/\/builds$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/chat$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("goes to Builds from the title", async ({ page }) => {
    await signIn(page, LUTHIER, "/chat");
    await page
      .getByRole("banner")
      .getByRole("link", { name: new RegExp(en.app.title) })
      .click();
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("shows the header with title, subtitle, switchers and user button, and no tab bar", async ({
    page,
  }) => {
    await signIn(page, LUTHIER);
    const header = page.getByRole("banner").first();
    await expect(header.getByText(en.app.subtitle)).toBeVisible();
    await expect(header.getByRole("radio", { name: en.language.frName })).toBeVisible();
    await expect(header.getByRole("radio", { name: en.theme.dark })).toBeVisible();
    await expect(header.getByRole("button", { name: new RegExp(LUTHIER.email) })).toBeVisible();
    await expect(page.getByRole("link", { name: en.nav.woodProperties }).last()).toBeVisible();
    await expect(page.locator("[data-admin]")).toHaveCount(0);
  });
});

test.describe("admin-only sections", () => {
  test("are hidden from users and redirect them to Builds", async ({ page }) => {
    await signIn(page, LUTHIER, "/chat");
    for (const path of ["/admin", "/references"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/builds$/);
      await expect(page.getByRole("heading", { level: 1, name: en.nav.builds })).toBeVisible();
      // Treated like an unknown route: the admin URL does not stay in history.
      await page.goBack();
      await expect(page).toHaveURL(/\/chat$/);
    }
  });

  test("are listed last for administrators, in the admin accent", async ({ page }) => {
    await signIn(page, ADMIN);
    expect(await navLabels(page)).toEqual([
      en.nav.builds,
      en.nav.chat,
      en.nav.simulator,
      en.nav.woodProperties,
      en.nav.references,
      en.nav.admin,
    ]);
    const color = (name: string) =>
      mainNav(page)
        .getByRole("link", { name })
        .evaluate((element) => getComputedStyle(element).color);
    const regular = await color(en.nav.chat);
    expect(await color(en.nav.references)).not.toBe(regular);
    expect(await color(en.nav.admin)).toBe(await color(en.nav.references));

    // Even at the narrowest desktop width, all six entries fit and the title is whole.
    await page.setViewportSize({ width: 1024, height: 700 });
    for (const text of [en.app.title, en.app.subtitle]) {
      const truncated = await page
        .getByRole("banner")
        .getByText(text, { exact: true })
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(truncated, text).toBe(false);
    }
    await expect(mainNav(page).getByRole("link", { name: en.nav.admin })).toBeInViewport();
  });

  test("survive a reload for administrators", async ({ page }) => {
    await signIn(page, ADMIN, "/admin");
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: en.nav.admin })).toBeVisible();
    await page.goto("/references");
    await expect(page.getByRole("heading", { level: 1, name: en.nav.references })).toBeVisible();
  });
});

test.describe("public story route", () => {
  test("is shown without the shell to a signed-in user", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.goto("/story/abc123");
    await expect(page).toHaveURL(/\/story\/abc123$/);
    await expect(page.getByRole("heading", { name: en.story.title })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(LUTHIER.email) })).toHaveCount(0);
  });
});

test.describe("user menu and sign-out", () => {
  test("shows who is signed in and closes on an outside click", async ({ page }) => {
    await signIn(page, LUTHIER);
    const button = page.getByRole("button", { name: new RegExp(LUTHIER.email) });
    await expect(button).toContainText(en.shell.signedInAs);
    await button.click();
    await expect(page.getByRole("menuitem", { name: en.shell.signOut })).toBeVisible();
    await page.mouse.click(640, 600);
    await expect(page.getByRole("menuitem", { name: en.shell.signOut })).toHaveCount(0);
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("signs out to the sign-in screen, which stays after a reload", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: new RegExp(LUTHIER.email) }).click();
    await page.getByRole("menuitem", { name: en.shell.signOut }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await page.goto("/builds");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fbuilds$/);
  });

  test("reports a failed sign-out and stays in the shell", async ({ page }) => {
    await signIn(page, LUTHIER);
    await fakeSupabase.configure({ failLogout: true });
    await page.getByRole("button", { name: new RegExp(LUTHIER.email) }).click();
    await page.getByRole("menuitem", { name: en.shell.signOut }).click();
    await expect(errorToast(page).filter({ hasText: en.shell.signOutFailed })).toBeVisible();
    await expect(page).toHaveURL(/\/builds$/);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: en.nav.builds })).toBeVisible();
  });

  test("switches the whole shell to French", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(mainNav(page).getByRole("link", { name: fr.nav.builds })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(LUTHIER.email) }).click();
    await expect(page.getByRole("menuitem", { name: fr.shell.signOut })).toBeVisible();
  });
});
