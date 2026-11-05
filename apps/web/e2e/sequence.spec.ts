// build-sequence end to end: the build map and part flows, the Steps checklist, the step
// screen with completion, notes, photos and measurements, and the cleanup of the old
// diagram's remembered viewports.
import { expect, type Page, test } from "@playwright/test";
import {
  en,
  errorToast,
  fakeSupabase,
  fr,
  LUTHIER,
  type SeedBuild,
  seedAccounts,
  signIn,
} from "./support";

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf000000030101005d1a6a1b0000000049454e44ae426082",
  "hex",
);
const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });

test.beforeEach(async () => {
  await seedAccounts();
});

/** Seeds a build for the luthier and signs in on its Steps view. */
async function openBuild(page: Page, build: Partial<SeedBuild> = {}) {
  const seeded = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Sequence",
    guitar_type: "steel_string",
    bobo_neck: true,
    ...build,
  });
  await signIn(page, LUTHIER, `/builds/${seeded.id}`);
  return seeded;
}

/** Seeds a build, signs in and opens one of its step screens. */
async function openStep(page: Page, key: string, build: Partial<SeedBuild> = {}) {
  const seeded = await openBuild(page, build);
  await page.goto(`/builds/${seeded.id}/steps/${key}`);
  await expect(page.getByRole("navigation", { name: en.sequence.nav.label })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return seeded;
}

const checklistRow = (page: Page, number: string) =>
  page
    .getByRole("region", { name: en.sequence.checklist.label })
    .getByRole("link", { name: new RegExp(`^Step ${number}:`) })
    .first();
const photos = (page: Page) => page.getByRole("region", { name: en.sequence.photos });
const sound = (page: Page) => page.getByRole("region", { name: en.sequence.soundAnalysis });
const flowSteps = (page: Page) => page.getByRole("list", { name: /^Steps of / }).getByRole("link");
const doneNext = (page: Page) => page.getByRole("button", { name: en.sequence.nav.doneNext });

async function storedStep(buildId: string, key: string) {
  const build = (await fakeSupabase.builds()).find((candidate) => candidate.id === buildId);
  return build?.sequence_state.find((entry) => entry.key === key);
}

const GROUP_KEYS = [
  "truss-rod",
  "fretboard",
  "neck",
  "top-panel",
  "braces",
  "back-panel",
  "sides",
  "end-blocks",
  "bridge",
  "nut-saddle",
  "neck-assembly",
  "body-finish",
  "heel-assembly",
  "body-assembly",
  "final-assembly",
];

test.describe("build map and part flows", () => {
  test("show a new steel-string BOBO build's 120 steps and 131 arrows, starting steps ready", async ({
    page,
  }) => {
    const build = await openBuild(page);
    await page.goto(`/builds/${build.id}/map`);
    await expect(page.getByRole("list", { name: en.sequence.legend.label })).toContainText(
      en.sequence.legend.ready,
    );
    let boxes = 0;
    let arrows = 0;
    let ready = 0;
    for (const key of GROUP_KEYS) {
      await page.goto(`/builds/${build.id}/map/${key}`);
      await expect(flowSteps(page).first()).toBeVisible();
      boxes += await flowSteps(page).count();
      ready += await page
        .getByRole("list", { name: /^Steps of / })
        .locator("a[aria-label$=', Ready']")
        .count();
      arrows += await page.locator("svg[data-connectors] path").count();
      arrows += await page
        .getByRole("list", { name: en.sequence.flow.leadsTo })
        .getByRole("link")
        .count();
      await expect(page.getByTestId("completion-badge")).toHaveCount(0);
    }
    expect([boxes, arrows, ready]).toEqual([120, 131, 10]);
  });

  test("number the steps and highlight the variant steps", async ({ page }) => {
    const build = await openBuild(page, { guitar_type: null, bobo_neck: true });
    const box = (name: RegExp) =>
      flowSteps(page)
        .filter({ has: page.getByText(name) })
        .first();
    await page.goto(`/builds/${build.id}/map/top-panel`);
    await expect(box(/^Fit and glue braces$/)).toContainText("036");
    await page.goto(`/builds/${build.id}/map/body-assembly`);
    await expect(box(/^Fit top and back$/)).toContainText("115");
    await page.goto(`/builds/${build.id}/map/neck`);
    await expect(box(/^CL cut off BOBO slat$/)).toHaveAttribute("data-highlight", "variant");
    await page.goto(`/builds/${build.id}/map/heel-assembly`);
    await expect(box(/^SS fit heel laminate/)).toHaveAttribute("data-highlight", "variant");
    await page.goto(`/builds/${build.id}/map/bridge`);
    await expect(box(/^Fabricate SS bridge blank$/)).toHaveAttribute(
      "data-highlight",
      "bridgeBlank",
    );
    await page.goto(`/builds/${build.id}/map/truss-rod`);
    await expect(box(/^Truss rod$/)).not.toHaveAttribute("data-highlight", /.+/);
  });

  test("do not move a step that is dragged", async ({ page }) => {
    const build = await openBuild(page);
    await page.goto(`/builds/${build.id}/map/neck`);
    const neck = flowSteps(page).first();
    const before = await neck.boundingBox();
    if (!before) throw new Error("no box");
    await page.mouse.move(before.x + 40, before.y + 20);
    await page.mouse.down();
    await page.mouse.move(before.x + 200, before.y + 160, { steps: 8 });
    await page.mouse.up();
    expect(await neck.boundingBox()).toEqual(before);
  });

  test("drop the viewports the old diagram remembered", async ({ page }) => {
    const build = await openBuild(page);
    await page.evaluate(() => localStorage.setItem("gb-viewport:old", '{"x":0,"y":0,"zoom":1}'));
    await page.goto(`/builds/${build.id}/map`);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("gb-viewport:old")))
      .toBeNull();
  });
});

test.describe("step completion and notes", () => {
  test("completes a step, keeps it after a reload, and reopens it", async ({ page }) => {
    const build = await openStep(page, "ThicknessBlank");
    await expect(page.getByText("Step 10", { exact: true })).toBeVisible();
    await expect(page.getByText(/Follow the sequence/)).toHaveCount(0);
    await doneNext(page).click();
    await expect(checklistRow(page, "010")).toHaveAccessibleName(/Completed$/);
    await expect
      .poll(async () => (await storedStep(build.id, "ThicknessBlank"))?.completed)
      .toBe(true);

    await page.goto(`/builds/${build.id}/steps/ThicknessBlank`);
    await expect(page.getByText(en.sequence.completedIcon, { exact: true })).toBeAttached();
    await page.getByRole("button", { name: en.sequence.markIncomplete }).click();
    await expect(checklistRow(page, "010")).not.toHaveAccessibleName(/Completed$/);
    await expect
      .poll(async () => (await storedStep(build.id, "ThicknessBlank"))?.completed)
      .toBe(false);
  });

  test("completes steps in any order", async ({ page }) => {
    await openStep(page, "PressFrets");
    await doneNext(page).click();
    await expect(
      page.getByRole("link", { name: /^Step 016: Press in frets, Completed/ }).first(),
    ).toBeVisible();
    await expect(checklistRow(page, "008")).toHaveAccessibleName(/Ready$/);
  });

  test("saves notes while typing, with line breaks", async ({ page }) => {
    const build = await openStep(page, "CutBraceBlank");
    const notes = page.getByLabel(en.sequence.notes);
    await expect(notes).toHaveAttribute("placeholder", en.sequence.notesPlaceholder);
    await notes.fill("Used 3 mm brace stock\nQuartersawn spruce");
    await expect
      .poll(async () => (await storedStep(build.id, "CutBraceBlank"))?.notes)
      .toBe("Used 3 mm brace stock\nQuartersawn spruce");

    await page.reload();
    await expect(page.getByLabel(en.sequence.notes)).toHaveValue(
      "Used 3 mm brace stock\nQuartersawn spruce",
    );
  });

  test("keeps notes typed just before completing the step", async ({ page }) => {
    const build = await openStep(page, "ThicknessBlank");
    await page.getByLabel(en.sequence.notes).pressSequentially("Planed to 4.2 mm", { delay: 5 });
    await doneNext(page).click();
    await expect
      .poll(async () => storedStep(build.id, "ThicknessBlank"))
      .toMatchObject({ notes: "Planed to 4.2 mm", completed: true });
  });

  test("tells the user when a change cannot be saved", async ({ page }) => {
    const build = await openStep(page, "ThicknessBlank");
    await fakeSupabase.configure({ failStepChanges: true });
    await doneNext(page).click();
    await expect(errorToast(page)).toContainText(en.builds.saveFailed);
    await expect(checklistRow(page, "010")).not.toHaveAccessibleName(/Completed$/);

    await page.goto(`/builds/${build.id}/steps/CutBraceBlank`);
    await page.getByLabel(en.sequence.notes).fill("Not lost");
    await expect(errorToast(page).filter({ hasText: en.builds.saveFailed })).not.toHaveCount(0);
    await expect(page.getByLabel(en.sequence.notes)).toHaveValue("Not lost");
  });
});

test.describe("step photos", () => {
  test("uploads several photos after the existing ones and shows them full screen", async ({
    page,
  }) => {
    const build = await openStep(page, "JoinPanels");
    const dialog = photos(page);
    await expect(dialog).toContainText(en.sequence.photo.empty);
    await dialog.getByTestId("photo-input").setInputFiles(png("first.png"));
    await expect(dialog.getByRole("img")).toHaveCount(1);
    await dialog
      .getByTestId("photo-input")
      .setInputFiles([png("a.png"), png("b.png"), png("c.png")]);
    await expect(dialog.getByRole("img")).toHaveCount(4);
    await expect
      .poll(async () => (await storedStep(build.id, "JoinPanels"))?.photos?.length)
      .toBe(4);
    const names =
      (await storedStep(build.id, "JoinPanels"))?.photos?.map((photo) => photo.name) ?? [];
    for (const name of names) expect(name).toMatch(/^\d+_[a-z0-9]{8}\.png$/);

    await dialog.getByRole("button", { name: "Open photo 2 full screen" }).click();
    const viewer = page.getByRole("dialog", { name: "Photo 2 of Join panels" });
    await expect(viewer.getByRole("img")).toBeVisible();
    await expect(async () => {
      await page.mouse.click(10, 10);
      await expect(viewer).toBeHidden({ timeout: 1000 });
    }).toPass();
    await expect(photos(page)).toBeVisible();
  });

  test("shows Uploading... while photos upload", async ({ page }) => {
    await openStep(page, "JoinPanels");
    await fakeSupabase.configure({ uploadDelayMs: 1000 });
    await photos(page).getByTestId("photo-input").setInputFiles(png("slow.png"));
    await expect(
      photos(page).getByRole("button", { name: en.sequence.photo.uploading }),
    ).toBeDisabled();
    await expect(photos(page).getByRole("img")).toHaveCount(1);
    await expect(photos(page).getByRole("button", { name: en.sequence.photo.add })).toBeEnabled();
  });

  test("keeps the photos that uploaded when others fail", async ({ page }) => {
    await openStep(page, "JoinPanels");
    await fakeSupabase.configure({ failUploadsMatching: "^fail" });
    await photos(page)
      .getByTestId("photo-input")
      .setInputFiles([png("one.png"), png("fail.png"), png("three.png")]);
    await expect(errorToast(page)).toContainText(en.sequence.photo.uploadFailed);
    await expect(photos(page).getByRole("img")).toHaveCount(2);

    await photos(page)
      .getByTestId("photo-input")
      .setInputFiles([png("fail-1.png"), png("fail-2.png")]);
    await expect(errorToast(page).filter({ hasText: en.sequence.photo.uploadFailed })).toHaveCount(
      2,
    );
    await expect(photos(page).getByRole("img")).toHaveCount(2);
  });

  test("deletes a photo and its file with one click", async ({ page }) => {
    const build = await openStep(page, "JoinPanels");
    await photos(page)
      .getByTestId("photo-input")
      .setInputFiles([png("a.png"), png("b.png"), png("c.png")]);
    await expect(photos(page).getByRole("img")).toHaveCount(3);
    const before = (await storedStep(build.id, "JoinPanels"))?.photos ?? [];
    await photos(page).getByRole("button", { name: "Delete photo 2" }).click();
    await expect(photos(page).getByRole("img")).toHaveCount(2);
    await expect
      .poll(async () =>
        (await storedStep(build.id, "JoinPanels"))?.photos?.map((photo) => photo.name),
      )
      .toEqual([before[0]?.name, before[2]?.name]);
    expect((await fetch(before[1]?.url ?? "")).status).toBe(400);
  });

  test("reports a photo that cannot be deleted and keeps it", async ({ page }) => {
    await openStep(page, "JoinPanels");
    await photos(page).getByTestId("photo-input").setInputFiles(png("a.png"));
    await expect(photos(page).getByRole("img")).toHaveCount(1);
    await fakeSupabase.configure({ failStorageRemove: true });
    await photos(page).getByRole("button", { name: "Delete photo 1" }).click();
    await expect(errorToast(page)).toContainText(en.sequence.photo.deleteFailed);
    await expect(photos(page).getByRole("img")).toHaveCount(1);
  });

  test("hides the Camera button on a device without a camera", async ({ page }) => {
    // Report no camera, whatever the machine running the test has.
    await page.addInitScript(() => {
      navigator.mediaDevices.enumerateDevices = async () => [];
    });
    await openStep(page, "JoinPanels");
    await expect(photos(page).getByRole("button", { name: en.sequence.photo.add })).toBeVisible();
    await expect(photos(page).getByRole("button", { name: en.sequence.photo.camera })).toHaveCount(
      0,
    );
  });
});

test.describe("step measurements", () => {
  const spectrum = {
    frequencies: [32.2265625, 98.25, 500, 1999],
    magnitudes: [0.001, 0.2, 0.01, 0.0001],
    magnitudesDb: [-120, -30, -50, -90],
    sampleRate: 48000,
    fftSize: 16384,
    binWidth: 2.9296875,
  };
  const seeded = {
    sequence_state: [
      {
        key: "TapTestPanels",
        measurements: [
          {
            id: "m1",
            timestamp: 1733500000000,
            description: "Resonance Analysis",
            frequency: 98.25,
            spectrum,
          },
          {
            id: "m2",
            timestamp: 1733600000000,
            description: "Second tap",
            frequency: 187.4,
            spectrum,
          },
        ],
      },
    ],
  };

  test("lists measurements with their peak and graph", async ({ page }) => {
    await openStep(page, "TapTestPanels", seeded);
    const dialog = sound(page);
    await expect(dialog.getByText("Peak: 98.3 Hz")).toBeVisible();
    await expect(dialog.getByText("Peak: 187.4 Hz")).toBeVisible();
    await expect(
      dialog.getByRole("img", { name: "Spectrum of Resonance Analysis, peak at 98.3 Hz" }),
    ).toBeVisible();
    await expect(dialog.getByTestId("peak-marker").first()).toContainText("98.3 Hz");
    await expect(dialog.locator("[data-measurement]").first()).toContainText("Resonance Analysis");
  });

  test("edits a description", async ({ page }) => {
    const build = await openStep(page, "TapTestPanels", seeded);
    await sound(page).getByRole("button", { name: "Edit description: Resonance Analysis" }).click();
    const prompt = page.getByRole("dialog", { name: en.sequence.measurement.editDescription });
    const input = prompt.getByRole("textbox");
    await expect(input).toHaveValue("Resonance Analysis");
    await input.fill("  Top after bracing ");
    await prompt.getByRole("button", { name: en.dialog.save }).click();
    await expect(page.getByText("Top after bracing", { exact: true })).toBeVisible();
    await expect
      .poll(
        async () => (await storedStep(build.id, "TapTestPanels"))?.measurements?.[0]?.description,
      )
      .toBe("Top after bracing");
  });

  test("deletes a measurement only after confirmation", async ({ page }) => {
    const build = await openStep(page, "TapTestPanels", seeded);
    await sound(page).getByRole("button", { name: "Delete sound analysis Second tap" }).click();
    let confirm = page.getByRole("dialog", { name: en.sequence.measurement.deleteTitle });
    await expect(confirm).toContainText(en.sequence.measurement.deleteMessage);
    await confirm.getByRole("button", { name: en.dialog.cancel }).click();
    await expect(page.getByText("Peak: 187.4 Hz")).toBeVisible();

    await sound(page).getByRole("button", { name: "Delete sound analysis Second tap" }).click();
    confirm = page.getByRole("dialog", { name: en.sequence.measurement.deleteTitle });
    await confirm.getByRole("button", { name: en.sequence.measurement.deleteConfirm }).click();
    await expect(page.getByText("Peak: 187.4 Hz")).toHaveCount(0);
    await expect
      .poll(async () =>
        (await storedStep(build.id, "TapTestPanels"))?.measurements?.map((m) => m.id),
      )
      .toEqual(["m1"]);
  });

  test("shows the empty state", async ({ page }) => {
    await openStep(page, "TapTestPanels");
    await expect(sound(page)).toContainText(en.sequence.measurement.empty);
  });
});

test.describe("French", () => {
  test("shows the checklist, a part flow and the step screen in French", async ({ page }) => {
    const build = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Française",
      guitar_type: "classical",
      bobo_neck: true,
      sequence_state: [
        {
          key: "TapTestPanels",
          measurements: [
            {
              id: "m1",
              timestamp: 1733500000000,
              description: "Fond libre",
              frequency: 98.25,
              spectrum: {
                frequencies: [98.25],
                magnitudes: [0.2],
                magnitudesDb: [-30],
                sampleRate: 48000,
                fftSize: 16384,
                binWidth: 2.9296875,
              },
            },
          ],
        },
      ],
    });
    await signIn(page, LUTHIER, `/builds/${build.id}`);
    await page
      .context()
      .addCookies([{ name: "gb-locale", value: "fr", url: "http://127.0.0.1:3100" }]);
    await page.reload();
    await expect(page.getByRole("list", { name: fr.sequence.checklist.readyNow })).toContainText(
      fr.steps.TrussRod,
    );
    await page.goto(`/builds/${build.id}/map/truss-rod`);
    await expect(page.getByRole("heading", { name: fr.groups.trussRod })).toBeVisible();
    await page.goto(`/builds/${build.id}/steps/TapTestPanels`);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 2, name: fr.steps.TapTestPanels }),
    ).toBeVisible();
    await expect(main).toContainText(fr.sequence.notes);
    await expect(main).toContainText(fr.sequence.soundAnalysis);
    await expect(main.getByRole("button", { name: fr.sequence.nav.doneNext })).toBeVisible();
    await expect(main.getByRole("button", { name: fr.sequence.photo.add })).toBeVisible();
    await expect(main.getByText("Pic : 98,3 Hz")).toBeVisible();
  });
});

test.describe("phone layout @phone", () => {
  test("goes from the checklist to a step and completes it on a phone", async ({ page }) => {
    await openBuild(page);
    await checklistRow(page, "001").click();
    await expect(page.getByRole("heading", { level: 2, name: "Truss rod" })).toBeVisible();
    await doneNext(page).click();
    await expect(page.getByRole("heading", { level: 2, name: /^Make truss rod/ })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: en.sequence.nav.back }).click();
    await expect(checklistRow(page, "001")).toHaveAccessibleName(/Completed$/);
  });
});
