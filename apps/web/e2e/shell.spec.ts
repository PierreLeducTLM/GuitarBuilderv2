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

const sidebar = (page: Page) => page.getByRole("complementary");
const mainNav = (page: Page) => sidebar(page).getByRole("navigation", { name: en.nav.label });

async function navLabels(page: Page) {
  return mainNav(page).getByRole("link").allTextContents();
}

/** Opens the You page from the sidebar's account entry. */
async function openYou(page: Page, email = LUTHIER.email) {
  await sidebar(page).getByRole("link", { name: email }).click();
  await expect(page).toHaveURL(/\/you$/);
}

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("signing in", () => {
  test("returns to the requested section", async ({ page }) => {
    await signIn(page, LUTHIER, "/chat");
    await expect(page.getByRole("heading", { level: 1, name: en.nav.assistant })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: en.nav.assistant })).toHaveAttribute(
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
  test("shows the sidebar with Builds, Tools and its sections, and Assistant, with icons", async ({
    page,
  }) => {
    await signIn(page, LUTHIER);
    expect(await navLabels(page)).toEqual([
      en.nav.builds,
      en.nav.tools,
      en.nav.woodPanels,
      en.nav.simulator,
      en.nav.assistant,
    ]);
    await expect(mainNav(page).locator("svg")).toHaveCount(5);
    await expect(sidebar(page).getByRole("link", { name: LUTHIER.email })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test("has no tab bar, menu button or header on a wide screen", async ({ page }) => {
    await signIn(page, LUTHIER);
    await expect(page.getByRole("navigation", { name: en.nav.label })).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /menu/i })).toHaveCount(0);
    await expect(page.locator("[data-admin]")).toHaveCount(0);
  });

  test("moves between sections and highlights the active one", async ({ page }) => {
    await signIn(page, LUTHIER);
    await mainNav(page).getByRole("link", { name: en.nav.simulator }).click();
    await expect(page).toHaveURL(/\/simulator$/);
    await expect(page.getByRole("heading", { level: 1, name: en.nav.simulator })).toBeVisible();
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveText(en.nav.simulator);

    await mainNav(page).getByRole("link", { name: en.nav.tools }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByRole("heading", { level: 1, name: en.tools.title })).toBeVisible();
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveText(en.nav.tools);
  });

  test("opens a tool from the Tools page and returns to it", async ({ page }) => {
    await signIn(page, LUTHIER, "/tools");
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(en.nav.woodPanels) })
      .click();
    await expect(page).toHaveURL(/\/wood-properties$/);
    await expect(page.getByRole("heading", { level: 1, name: en.wood.title })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: en.nav.tools }).click();
    await expect(page).toHaveURL(/\/tools$/);
  });

  test("highlights the build being viewed among the recent builds", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Highlighted",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Highlighted" })).toBeVisible();
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveCount(1);
    await expect(mainNav(page).locator("[aria-current=page]")).toHaveText("Highlighted");
  });

  test("lists the five most recently changed builds, most recent first", async ({ page }) => {
    for (let day = 1; day <= 7; day += 1) {
      await fakeSupabase.seedBuild({
        ownerEmail: LUTHIER.email,
        name: `Build ${day}`,
        created_at: "2026-09-01T12:00:00.000Z",
        updated_at: `2026-10-0${day}T12:00:00.000Z`,
      });
    }
    await fakeSupabase.seedBuild({ ownerEmail: ADMIN.email, name: "Admin build" });
    await signIn(page, LUTHIER);
    await expect(
      mainNav(page).getByRole("list", { name: en.nav.recentBuilds }).getByRole("link"),
    ).toHaveText(["Build 7", "Build 6", "Build 5", "Build 4", "Build 3"]);
  });

  test("lists only an administrator's own builds among the recent builds", async ({ page }) => {
    const other = await fakeSupabase.seedBuild({ ownerEmail: LUTHIER.email, name: "Not mine" });
    await fakeSupabase.seedBuild({ ownerEmail: ADMIN.email, name: "Mine" });
    await signIn(page, ADMIN, `/builds/${other.id}`);
    await expect(
      mainNav(page).getByRole("list", { name: en.nav.recentBuilds }).getByRole("link"),
    ).toHaveText(["Mine"]);
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
    await sidebar(page).getByRole("link", { name: en.app.title }).click();
    await expect(page).toHaveURL(/\/builds$/);
  });
});

test.describe("You page", () => {
  test("shows the account and the preferences", async ({ page }) => {
    await signIn(page, LUTHIER);
    await openYou(page);
    await expect(page.getByRole("heading", { level: 1, name: en.you.title })).toBeVisible();
    await expect(page.getByText(en.shell.signedInAs)).toBeVisible();
    await expect(page.getByRole("main").getByText(LUTHIER.email)).toBeVisible();
    await expect(page.getByRole("radio", { name: en.language.frName })).toBeVisible();
    await expect(page.getByRole("radio", { name: en.theme.dark })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: LUTHIER.email })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("changes the theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signIn(page, LUTHIER, "/you");
    await page.getByRole("radio", { name: en.theme.dark }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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

  test("are listed last for administrators, in the admin accent, and on the You page", async ({
    page,
  }) => {
    await signIn(page, ADMIN);
    expect(await navLabels(page)).toEqual([
      en.nav.builds,
      en.nav.tools,
      en.nav.woodPanels,
      en.nav.simulator,
      en.nav.assistant,
      en.nav.references,
      en.nav.admin,
    ]);
    const color = (name: string) =>
      mainNav(page)
        .getByRole("link", { name })
        .evaluate((element) => getComputedStyle(element).color);
    const regular = await color(en.nav.assistant);
    expect(await color(en.nav.references)).not.toBe(regular);
    expect(await color(en.nav.admin)).toBe(await color(en.nav.references));

    await openYou(page, ADMIN.email);
    const group = page.getByRole("main").getByRole("region", { name: en.you.administration });
    await expect(group.getByRole("link")).toHaveText([en.nav.references, en.nav.admin]);

    // At the narrowest desktop width every entry is reachable and the title is whole.
    await page.setViewportSize({ width: 1024, height: 700 });
    const truncated = await sidebar(page)
      .getByText(en.app.title, { exact: true })
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(truncated).toBe(false);
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
    await expect(page.getByRole("heading", { name: en.story.notFound.title })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(LUTHIER.email) })).toHaveCount(0);
  });
});

test.describe("sign-out", () => {
  test("signs out from the You page to the sign-in screen, which stays after a reload", async ({
    page,
  }) => {
    await signIn(page, LUTHIER);
    await openYou(page);
    await page.getByRole("button", { name: en.shell.signOut }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: en.auth.signIn, exact: true })).toBeVisible();
    await page.goto("/builds");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fbuilds$/);
  });

  test("reports a failed sign-out and stays in the shell", async ({ page }) => {
    await signIn(page, LUTHIER, "/you");
    await fakeSupabase.configure({ failLogout: true });
    await page.getByRole("button", { name: en.shell.signOut }).click();
    await expect(errorToast(page).filter({ hasText: en.shell.signOutFailed })).toBeVisible();
    await expect(page).toHaveURL(/\/you$/);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: en.you.title })).toBeVisible();
  });

  test("switches the whole shell to French", async ({ page }) => {
    await signIn(page, LUTHIER, "/you");
    await page.getByRole("radio", { name: en.language.frName }).check();
    await expect(mainNav(page).getByRole("link", { name: fr.nav.builds })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: fr.nav.tools })).toBeVisible();
    await expect(page.getByRole("button", { name: fr.shell.signOut })).toBeVisible();
  });
});
