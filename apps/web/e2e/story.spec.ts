// build-story-sharing end to end: sharing a build from its page, the public story an
// anonymous visitor sees, turning sharing off and on again, and Story Not Found.
// Live updates need Realtime, which the fake server lacks; component tests and a manual
// check on a local Supabase stack cover them.
import { type Browser, expect, type Page, test } from "@playwright/test";
import { en, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";

const APP = "http://127.0.0.1:3100";

test.beforeEach(async () => {
  await seedAccounts();
});

async function seedStoryBuild() {
  return fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "OM #3",
    guitar_type: "steel_string",
    bobo_neck: true,
    created_at: "2025-12-06T15:30:00Z",
    sequence_state: [
      { key: "TrussRod", completed: true, notes: "Rod bent.", photos: [], measurements: [] },
      { key: "MakeTrussNut", completed: false, notes: "Secret plan", photos: [], measurements: [] },
    ],
  });
}

const shareDialog = (page: Page) => page.getByRole("dialog", { name: en.builds.share.title });
const publicAccess = (page: Page) =>
  shareDialog(page).getByRole("switch", { name: en.builds.share.publicAccess });

async function openShareDialog(page: Page, buildId: string) {
  if (!page.url().endsWith(`/builds/${buildId}`)) await page.goto(`/builds/${buildId}`);
  await page.getByRole("button", { name: en.builds.actions.more }).click();
  await page.getByRole("menuitem", { name: en.builds.detail.share }).click();
  await expect(publicAccess(page)).toBeEnabled();
}

/** Turns public access to `on` and returns the link shown, if any. */
async function setPublicAccess(page: Page, on: boolean): Promise<string | null> {
  if ((await publicAccess(page).getAttribute("aria-checked")) !== String(on)) {
    await publicAccess(page).click();
  }
  await expect(publicAccess(page)).toHaveAttribute("aria-checked", String(on));
  await expect(publicAccess(page)).toBeEnabled();
  if (!on) return null;
  return shareDialog(page).getByLabel(en.builds.share.link).inputValue();
}

async function anonymousPage(browser: Browser) {
  const context = await browser.newContext();
  return context.newPage();
}

test.describe("sharing a build", () => {
  test("shares the story through a link the owner copies and previews", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP });
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    await expect(shareDialog(page).getByText(en.builds.share.statusOff)).toBeVisible();
    await expect(shareDialog(page).getByText(en.builds.share.disabledTitle)).toBeVisible();

    const link = await setPublicAccess(page, true);
    expect(link).toMatch(new RegExp(`^${APP}/story/[0-9a-f-]{36}$`));
    await expect(shareDialog(page).getByText(en.builds.share.statusOn)).toBeVisible();
    await expect(shareDialog(page).getByText(en.builds.share.tip)).toBeVisible();

    await shareDialog(page).getByRole("button", { name: en.builds.share.copy }).click();
    await expect(
      shareDialog(page).getByRole("button", { name: en.builds.share.copied }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

    const [preview] = await Promise.all([
      context.waitForEvent("page"),
      shareDialog(page).getByRole("link", { name: en.builds.share.preview }).click(),
    ]);
    await expect(preview).toHaveURL(link ?? "");
    await expect(preview.getByRole("heading", { level: 1, name: "OM #3" })).toBeVisible();
  });

  test("shows an anonymous visitor the documented steps and nothing else", async ({
    page,
    browser,
  }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const link = await setPublicAccess(page, true);

    const visitor = await anonymousPage(browser);
    await visitor.goto(link ?? "");
    await expect(visitor.getByRole("heading", { level: 1, name: "OM #3" })).toBeVisible();
    await expect(visitor.getByText("Started December 6, 2025")).toBeVisible();
    await expect(visitor.getByText("1 of 120 steps")).toBeVisible();
    await expect(visitor.getByText("1% Complete")).toBeVisible();
    await expect(visitor.getByRole("heading", { name: en.steps.TrussRod })).toBeVisible();
    await expect(visitor.getByText("Rod bent.")).toBeVisible();
    await expect(visitor.getByText("Secret plan")).toHaveCount(0);
    await expect(visitor.getByText(LUTHIER.email)).toHaveCount(0);
    await expect(visitor.getByRole("navigation")).toHaveCount(0);
    await expect(visitor.getByRole("button", { name: en.auth.signIn, exact: true })).toHaveCount(0);
  });

  test("stops the link working when sharing is turned off", async ({ page, browser }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const link = await setPublicAccess(page, true);
    const visitor = await anonymousPage(browser);
    await visitor.goto(link ?? "");
    await expect(visitor.getByRole("heading", { level: 1, name: "OM #3" })).toBeVisible();

    await setPublicAccess(page, false);
    await expect(shareDialog(page).getByText(en.builds.share.disabledTitle)).toBeVisible();
    await visitor.reload();
    await expect(
      visitor.getByRole("heading", { level: 1, name: en.story.notFound.title }),
    ).toBeVisible();
    await expect(visitor.getByText(en.story.notFound.message)).toBeVisible();
  });

  test("gives a new link after sharing is turned off and on, and the old one stays dead", async ({
    page,
    browser,
  }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const first = await setPublicAccess(page, true);
    await setPublicAccess(page, false);
    const second = await setPublicAccess(page, true);
    expect(second).not.toBe(first);

    const visitor = await anonymousPage(browser);
    await visitor.goto(first ?? "");
    await expect(
      visitor.getByRole("heading", { level: 1, name: en.story.notFound.title }),
    ).toBeVisible();
    await visitor.goto(second ?? "");
    await expect(visitor.getByRole("heading", { level: 1, name: "OM #3" })).toBeVisible();
  });

  test("shows the same link after leaving the build and coming back", async ({ page }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const link = await setPublicAccess(page, true);
    await shareDialog(page).getByRole("button", { name: en.builds.share.done }).click();

    await page.getByRole("main").getByRole("link", { name: en.nav.builds, exact: true }).click();
    await expect(page).toHaveURL(/\/builds$/);
    await page.getByRole("main").getByRole("link", { name: /OM #3/ }).click();
    await openShareDialog(page, build.id);
    await expect(publicAccess(page)).toHaveAttribute("aria-checked", "true");
    await expect(shareDialog(page).getByLabel(en.builds.share.link)).toHaveValue(link ?? "");
  });
});

test.describe("story links", () => {
  test("shows Story Not Found for a malformed or unknown link", async ({ page }) => {
    for (const token of ["abc", "99999999-0000-4000-8000-000000000009"]) {
      await page.goto(`/story/${token}`);
      await expect(
        page.getByRole("heading", { level: 1, name: en.story.notFound.title }),
      ).toBeVisible();
      await expect(page.getByText(en.story.notFound.message)).toBeVisible();
    }
  });

  test("serves the story's service worker to anyone", async ({ request }) => {
    const response = await request.get("/story/sw.js", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");
    expect(await response.text()).toContain("notificationclick");
  });

  test("shows the story in the visitor's stored language", async ({ page, browser }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const link = await setPublicAccess(page, true);

    const context = await browser.newContext();
    await context.addCookies([{ name: "gb-locale", value: "fr", url: APP }]);
    const visitor = await context.newPage();
    await visitor.goto(link ?? "");
    await expect(visitor.getByText(fr.story.title)).toBeVisible();
    await expect(visitor.getByText("Commencée le 6 décembre 2025")).toBeVisible();
    await expect(visitor.getByText("1 étape sur 120")).toBeVisible();
  });

  test("fits a phone screen without sideways scrolling @phone", async ({ page, browser }) => {
    const build = await seedStoryBuild();
    await signIn(page, LUTHIER);
    await openShareDialog(page, build.id);
    const link = await setPublicAccess(page, true);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const visitor = await context.newPage();
    await visitor.goto(link ?? "");
    await expect(visitor.getByRole("heading", { level: 1, name: "OM #3" })).toBeVisible();
    const overflow = await visitor.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
