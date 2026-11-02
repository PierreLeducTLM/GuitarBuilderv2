// guitar-builds end to end: list, creation, detail page, variant change, deletion,
// deep links and the administrator's read-only view.
import { expect, type Page, test } from "@playwright/test";
import { ADMIN, en, errorToast, fakeSupabase, fr, LUTHIER, seedAccounts, signIn } from "./support";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf000000030101005d1a6a1b0000000049454e44ae426082",
  "hex",
);

async function useFrench(page: Page) {
  await page
    .context()
    .addCookies([{ name: "gb-locale", value: "fr", url: "http://127.0.0.1:3100" }]);
}

const addDialog = (page: Page) => page.getByRole("dialog", { name: en.builds.create.title });

test.beforeEach(async () => {
  await seedAccounts();
});

test.describe("builds list", () => {
  test("lists the user's builds newest first, with their count and guitar type", async ({
    page,
  }) => {
    await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "A",
      guitar_type: "classical",
      created_at: "2025-03-01T10:00:00Z",
    });
    await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "B",
      guitar_type: null,
      created_at: "2025-03-05T10:00:00Z",
    });
    await fakeSupabase.seedBuild({
      ownerEmail: ADMIN.email,
      name: "Admin's build",
      guitar_type: "classical",
    });

    await signIn(page, LUTHIER);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Builds (2)");
    const cards = page.getByRole("main").getByRole("listitem");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toHaveText("B");
    await expect(cards.nth(1)).toHaveText(`A${en.builds.guitarType.classical}`);

    await cards.nth(1).getByRole("link").click();
    const builds = await fakeSupabase.builds();
    const a = builds.find((build) => build.name === "A");
    await expect(page).toHaveURL(new RegExp(`/builds/${a?.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: "A" })).toBeVisible();
  });

  test("shows the empty state to a user without builds", async ({ page }) => {
    await signIn(page, LUTHIER);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Builds (0)");
    await expect(page.getByText(en.builds.empty)).toBeVisible();
    await expect(page.getByText(en.builds.emptyHint)).toBeVisible();
  });

  test("says when the builds cannot be loaded", async ({ page }) => {
    await fakeSupabase.configure({ failBuildList: true });
    await signIn(page, LUTHIER);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(en.builds.loadFailed);
  });

  test("is in French for a French user", async ({ page }) => {
    await signIn(page, LUTHIER);
    await useFrench(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vos fabrications (0)");
    await page.getByRole("button", { name: fr.builds.addNew }).click();
    await expect(page.getByRole("dialog", { name: fr.builds.create.title })).toBeVisible();
  });
});

test.describe("creating a build", () => {
  test("opens with an empty name, no guitar type and the BOBO neck checked", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    const dialog = addDialog(page);
    const name = dialog.getByLabel(en.builds.create.nameLabel);
    await expect(name).toHaveValue("");
    await expect(name).toHaveAttribute("placeholder", en.builds.create.namePlaceholder);
    await expect(
      dialog.getByRole("radio", { name: en.builds.guitarType.classical }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("radio", { name: en.builds.guitarType.steel_string }),
    ).not.toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: en.builds.create.boboLabel })).toBeChecked();
  });

  test("needs a name and a guitar type", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    const dialog = addDialog(page);
    await dialog.getByLabel(en.builds.create.nameLabel).fill("   ");
    await dialog.getByRole("radio", { name: en.builds.guitarType.classical }).check();
    await dialog.getByRole("button", { name: en.builds.create.submit }).click();
    await expect(dialog.getByText(en.builds.create.nameRequired)).toBeVisible();

    await dialog.getByLabel(en.builds.create.nameLabel).fill("Build #1");
    await page.reload();
    await page.getByRole("button", { name: en.builds.addNew }).click();
    await addDialog(page).getByLabel(en.builds.create.nameLabel).fill("Build #1");
    await addDialog(page).getByRole("button", { name: en.builds.create.submit }).click();
    await expect(addDialog(page).getByText(en.builds.create.typeRequired)).toBeVisible();
    await expect(addDialog(page)).toBeVisible();
    expect(await fakeSupabase.builds()).toHaveLength(0);
  });

  test("creates nothing when cancelled", async ({ page }) => {
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    await addDialog(page).getByLabel(en.builds.create.nameLabel).fill("Never mind");
    await addDialog(page).getByRole("button", { name: en.dialog.cancel }).click();
    await expect(addDialog(page)).toBeHidden();
    expect(await fakeSupabase.builds()).toHaveLength(0);
  });

  test("creates the build, opens it and lists it first", async ({ page }) => {
    await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Older",
      guitar_type: "classical",
      created_at: "2025-01-01T10:00:00Z",
    });
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    const dialog = addDialog(page);
    await dialog.getByLabel(en.builds.create.nameLabel).fill("Test Guitar #1");
    await dialog.getByRole("radio", { name: en.builds.guitarType.steel_string }).check();
    await dialog.getByRole("button", { name: en.builds.create.submit }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Test Guitar #1" })).toBeVisible();
    const created = (await fakeSupabase.builds()).find((build) => build.name === "Test Guitar #1");
    expect(created).toMatchObject({
      guitar_type: "steel_string",
      bobo_neck: true,
      sequence_state: [],
    });
    await expect(page).toHaveURL(new RegExp(`/builds/${created?.id}$`));
    await expect(addDialog(page)).toBeHidden();

    await page.getByRole("link", { name: en.builds.detail.back }).click();
    await expect(page).toHaveURL(/\/builds$/);
    await expect(page.getByRole("main").getByRole("listitem").first()).toContainText(
      "Test Guitar #1",
    );
  });

  test("allows duplicate names", async ({ page }) => {
    await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Build #1",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    await addDialog(page).getByLabel(en.builds.create.nameLabel).fill("Build #1");
    await addDialog(page).getByRole("radio", { name: en.builds.guitarType.classical }).check();
    await addDialog(page).getByRole("button", { name: en.builds.create.submit }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Build #1" })).toBeVisible();
    expect((await fakeSupabase.builds()).filter((build) => build.name === "Build #1")).toHaveLength(
      2,
    );
  });

  test("shows Adding... and creates one build when pressed twice", async ({ page }) => {
    await fakeSupabase.configure({ buildInsertDelayMs: 800 });
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    const dialog = addDialog(page);
    await dialog.getByLabel(en.builds.create.nameLabel).fill("Once");
    await dialog.getByRole("radio", { name: en.builds.guitarType.classical }).check();
    const submit = dialog.getByRole("button", { name: en.builds.create.submit });
    await submit.dblclick();
    await expect(dialog.getByRole("button", { name: en.builds.create.submitting })).toBeDisabled();
    await expect(page.getByRole("heading", { level: 1, name: "Once" })).toBeVisible();
    expect(await fakeSupabase.builds()).toHaveLength(1);
  });

  test("keeps the dialog open with the name when creation fails", async ({ page }) => {
    await fakeSupabase.configure({ failBuildInsert: true });
    await signIn(page, LUTHIER);
    await page.getByRole("button", { name: en.builds.addNew }).click();
    const dialog = addDialog(page);
    await dialog.getByLabel(en.builds.create.nameLabel).fill("Test Guitar #1");
    await dialog.getByRole("radio", { name: en.builds.guitarType.classical }).check();
    await dialog.getByRole("button", { name: en.builds.create.submit }).click();
    await expect(dialog.getByRole("alert")).toHaveText(en.builds.create.failed);
    await expect(dialog.getByLabel(en.builds.create.nameLabel)).toHaveValue("Test Guitar #1");
  });
});

test.describe("build detail page", () => {
  test("shows the header in English and French", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Build #1",
      guitar_type: "steel_string",
      bobo_neck: true,
      created_at: "2025-12-06T15:00:00Z",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Build #1" })).toBeVisible();
    const main = page.getByRole("main");
    await expect(
      main.getByText(en.builds.guitarType.steel_string, { exact: true }).first(),
    ).toBeVisible();
    await expect(main.getByText(en.builds.detail.boboNeck, { exact: true })).toBeVisible();
    await expect(main.getByText("Created Dec 6, 2025")).toBeVisible();
    await expect(main.getByRole("button", { name: en.builds.detail.delete })).toBeVisible();
    await expect(main.getByRole("tab", { name: en.builds.detail.tabOverview })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await useFrench(page);
    await page.reload();
    await expect(main.getByRole("link", { name: fr.builds.detail.back })).toBeVisible();
    await expect(main.getByRole("tab", { name: fr.builds.detail.tabOverview })).toBeVisible();
    await expect(main.getByRole("tab", { name: fr.builds.detail.tabSequence })).toBeVisible();
    await expect(main.getByRole("button", { name: fr.builds.detail.delete })).toBeVisible();
    await expect(main.getByText("Créée le 6 déc. 2025")).toBeVisible();
  });

  test("goes back to the list", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "X",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("link", { name: en.builds.detail.back }).click();
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("sends links to another user's build or a deleted build back to the list", async ({
    page,
  }) => {
    const other = await fakeSupabase.seedBuild({
      ownerEmail: ADMIN.email,
      name: "Not yours",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER);
    await page.goto(`/builds/${other.id}`);
    await expect(page).toHaveURL(/\/builds$/);
    await page.goto("/builds/6fe2f255-5aba-45fe-985d-68d26d1161ce");
    await expect(page).toHaveURL(/\/builds$/);
    await page.goto("/builds/not-a-build");
    await expect(page).toHaveURL(/\/builds$/);
  });

  test("summarizes progress, the latest measurement and the next step", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "In progress",
      guitar_type: "steel_string",
      bobo_neck: true,
      sequence_state: [
        { key: "TrussRod", completed: true },
        {
          key: "TapTestPanels",
          measurements: [
            measurement("m1", 1733400000000, "Early", 150.2),
            measurement("m2", 1733500000000, "Back plate", 181.64),
          ],
        },
      ],
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    const main = page.getByRole("main");
    await expect(main.getByText("1 of 120 steps · 1%")).toBeVisible();
    await expect(main.getByText("181.6 Hz")).toBeVisible();
    await main.getByRole("button", { name: "Next up: Make truss rod nut" }).click();
    const dialog = page.getByRole("dialog", { name: /Make truss rod nut/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: en.sequence.close }).last().click();
    await expect(main.getByRole("tab", { name: en.builds.detail.tabSequence })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("starts on the Overview tab after a reload", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Tabs",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(page.locator("[data-step]").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("tab", { name: en.builds.detail.tabOverview })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: en.builds.construction.title })).toBeVisible();
  });

  test("changes the construction variant and keeps hidden steps' data", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Variant",
      guitar_type: "steel_string",
      bobo_neck: true,
      sequence_state: [{ key: "FabricateBridge", notes: "Rosewood blank" }],
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    const main = page.getByRole("main");
    await expect(main.getByText("BOBO neck: Yes")).toBeVisible();

    await main.getByRole("button", { name: en.builds.construction.change }).click();
    const dialog = page.getByRole("dialog", { name: en.builds.construction.title });
    await dialog.getByRole("radio", { name: en.builds.guitarType.classical }).check();
    await dialog.getByRole("button", { name: en.dialog.save }).click();
    await expect(dialog).toBeHidden();
    await expect(
      main.getByText(en.builds.guitarType.classical, { exact: true }).first(),
    ).toBeVisible();
    expect((await fakeSupabase.builds())[0]?.guitar_type).toBe("classical");

    await main.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(page.locator("[data-step=FabricateCLBridge]")).toBeVisible();
    await expect(page.locator("[data-step=FabricateBridge]")).toHaveCount(0);

    await main.getByRole("tab", { name: en.builds.detail.tabOverview }).click();
    await main.getByRole("button", { name: en.builds.construction.change }).click();
    await dialog.getByRole("radio", { name: en.builds.guitarType.steel_string }).check();
    await dialog.getByRole("button", { name: en.dialog.save }).click();
    await main.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await page.locator("[data-step=FabricateBridge]").click();
    await expect(page.getByRole("dialog").getByLabel(en.sequence.notes)).toHaveValue(
      "Rosewood blank",
    );
  });

  test("invites the owner to choose a guitar type for an imported build", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Imported",
      guitar_type: null,
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    const main = page.getByRole("main");
    await expect(main.getByText(en.builds.detail.typeNotSet).first()).toBeVisible();
    await expect(main.getByText(en.builds.construction.notSetHint)).toBeVisible();
    await main.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(page.locator("[data-step]")).toHaveCount(132);
  });
});

test.describe("deleting a build", () => {
  test("deletes the build and its photo files after confirmation", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Doomed",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await page.locator("[data-step=JoinPanels]").click();
    await page
      .getByTestId("photo-input")
      .setInputFiles({ name: "joint.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("dialog").getByRole("img")).toHaveCount(1);
    expect(await fakeSupabase.objects()).toHaveLength(1);
    await page.getByRole("dialog").getByRole("button", { name: en.sequence.close }).last().click();

    await page.getByRole("button", { name: en.builds.detail.delete }).click();
    const confirm = page.getByRole("dialog", { name: en.builds.deleteDialog.title });
    await expect(confirm).toContainText(en.builds.deleteDialog.message);
    await confirm.getByRole("button", { name: en.builds.deleteDialog.confirm }).click();
    await expect(page).toHaveURL(/\/builds$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Builds (0)");
    expect(await fakeSupabase.builds()).toHaveLength(0);
    expect(await fakeSupabase.objects()).toHaveLength(0);
  });

  test("changes nothing when cancelled", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Kept",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("button", { name: en.builds.detail.delete }).click();
    await page
      .getByRole("dialog", { name: en.builds.deleteDialog.title })
      .getByRole("button", { name: en.dialog.cancel })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
    expect(await fakeSupabase.builds()).toHaveLength(1);
  });

  test("reports a failed deletion and keeps the build", async ({ page }) => {
    await fakeSupabase.configure({ failBuildDelete: true });
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Stubborn",
      guitar_type: "classical",
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page.getByRole("button", { name: en.builds.detail.delete }).click();
    await page
      .getByRole("dialog", { name: en.builds.deleteDialog.title })
      .getByRole("button", { name: en.builds.deleteDialog.confirm })
      .click();
    await expect(errorToast(page)).toContainText(en.builds.deleteDialog.failed);
    await expect(page).toHaveURL(new RegExp(`/builds/${build.id}$`));
    expect(await fakeSupabase.builds()).toHaveLength(1);
  });
});

test.describe("administrator access", () => {
  test("lists only the administrator's own builds", async ({ page }) => {
    await fakeSupabase.seedBuild({
      ownerEmail: ADMIN.email,
      name: "Admin build",
      guitar_type: "classical",
    });
    for (let i = 0; i < 3; i++) {
      await fakeSupabase.seedBuild({
        ownerEmail: LUTHIER.email,
        name: `Luthier ${i}`,
        guitar_type: "classical",
      });
    }
    await signIn(page, ADMIN);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your Builds (1)");
  });

  test("opens another user's build read-only", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Luthier's build",
      guitar_type: "classical",
      sequence_state: [{ key: "Neck", notes: "Mahogany" }],
    });
    await signIn(page, ADMIN, `/builds/${build.id}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "Luthier's build" })).toBeVisible();
    await expect(main.getByText(en.builds.detail.readOnly)).toBeVisible();
    await expect(main.getByRole("button", { name: en.builds.detail.delete })).toHaveCount(0);
    await expect(main.getByRole("button", { name: en.builds.construction.change })).toHaveCount(0);

    await main.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await page.locator("[data-step=Neck]").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel(en.sequence.notes)).toHaveValue("Mahogany");
    await expect(dialog.getByLabel(en.sequence.notes)).toHaveAttribute("readonly", "");
    await expect(dialog.getByRole("button", { name: en.sequence.markCompleted })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: en.sequence.photo.add })).toHaveCount(0);
  });
});

function measurement(id: string, timestamp: number, description: string, frequency: number) {
  return {
    id,
    timestamp,
    description,
    frequency,
    spectrum: {
      frequencies: [100, 181.640625, 400],
      magnitudes: [0.01, 0.2, 0.02],
      magnitudesDb: [-60, -30, -70],
      sampleRate: 48000,
      fftSize: 16384,
      binWidth: 2.9296875,
    },
  };
}
