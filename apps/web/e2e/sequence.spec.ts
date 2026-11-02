// build-sequence end to end: the diagram, step completion, notes, photos, measurements
// and the remembered viewport.
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

/** Seeds a build for the luthier, signs in and opens its Sequence Diagram tab. */
async function openDiagram(page: Page, build: Partial<SeedBuild> = {}) {
  const seeded = await fakeSupabase.seedBuild({
    ownerEmail: LUTHIER.email,
    name: "Sequence",
    guitar_type: "steel_string",
    bobo_neck: true,
    ...build,
  });
  await signIn(page, LUTHIER, `/builds/${seeded.id}`);
  await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
  await expect(page.locator("[data-step]").first()).toBeVisible();
  return seeded;
}

const step = (page: Page, key: string) => page.locator(`[data-step=${key}]`);
const stepDialog = (page: Page) => page.getByRole("dialog").first();

async function storedStep(buildId: string, key: string) {
  const build = (await fakeSupabase.builds()).find((candidate) => candidate.id === buildId);
  return build?.sequence_state.find((entry) => entry.key === key);
}

test.describe("sequence diagram", () => {
  test("shows a new steel-string BOBO build's 120 steps and 131 arrows, starting steps ready", async ({
    page,
  }) => {
    await openDiagram(page);
    await expect(page.locator(".react-flow__node")).toHaveCount(120);
    await expect(page.locator(".react-flow__edge")).toHaveCount(131);
    await expect(page.getByTestId("completion-badge")).toHaveCount(0);
    await expect(page.locator("[data-status=ready]")).toHaveCount(10);
    await expect(step(page, "TrussRod")).toHaveAttribute("data-status", "ready");
    await expect(page.getByRole("list", { name: en.sequence.legend.label })).toContainText(
      en.sequence.legend.ready,
    );
  });

  test("shows a classical build without a BOBO neck as 112 steps and 120 arrows", async ({
    page,
  }) => {
    await openDiagram(page, { guitar_type: "classical", bobo_neck: false });
    await expect(page.locator(".react-flow__node")).toHaveCount(112);
    await expect(page.locator(".react-flow__edge")).toHaveCount(120);
  });

  test("numbers the steps and highlights the variant steps", async ({ page }) => {
    await openDiagram(page, { guitar_type: null, bobo_neck: true });
    await expect(step(page, "FitGlueBraces")).toContainText("036");
    await expect(step(page, "FitTopBack")).toContainText("115");
    await expect(step(page, "CLCutBOBO")).toHaveAttribute("data-highlight", "variant");
    await expect(step(page, "SSFitHeel")).toHaveAttribute("data-highlight", "variant");
    await expect(step(page, "FabricateBridge")).toHaveAttribute("data-highlight", "bridgeBlank");
    await expect(step(page, "TrussRod")).not.toHaveAttribute("data-highlight", /.+/);
  });

  test("does not move a step that is dragged", async ({ page }) => {
    await openDiagram(page);
    const node = page.locator(".react-flow__node").filter({ has: step(page, "Neck") });
    const before = await node.getAttribute("style");
    const box = await step(page, "Neck").boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.move(box.x + 50, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 200, { steps: 8 });
    await page.mouse.up();
    expect(await node.getAttribute("style")).toBe(before);
  });

  test("remembers the viewport per build", async ({ page }) => {
    const first = await openDiagram(page);
    const viewport = page.locator(".react-flow__viewport");
    const fitted = await viewport.getAttribute("style");
    await page.getByRole("button", { name: en.sequence.controls.zoomIn }).click();
    await page.getByRole("button", { name: en.sequence.controls.zoomIn }).click();
    await expect(viewport).not.toHaveAttribute("style", fitted ?? "");
    await expect
      .poll(() => page.evaluate((id) => localStorage.getItem(`gb-viewport:${id}`), first.id))
      .not.toBeNull();
    const zoomed = await viewport.getAttribute("style");

    await page.reload();
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(viewport).toHaveAttribute("style", zoomed ?? "");

    const second = await fakeSupabase.seedBuild({
      ownerEmail: LUTHIER.email,
      name: "Other",
      guitar_type: "steel_string",
      bobo_neck: true,
    });
    await page.goto(`/builds/${second.id}`);
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(viewport).toHaveAttribute("style", fitted ?? "");
  });
});

test.describe("step completion and notes", () => {
  test("completes a step, keeps it after a reload, and reopens it", async ({ page }) => {
    const build = await openDiagram(page);
    await step(page, "ThicknessBlank").click();
    const dialog = stepDialog(page);
    await expect(dialog).toContainText("Step 10");
    await expect(dialog).toContainText(en.sequence.hint);
    await dialog.getByRole("button", { name: en.sequence.markCompleted }).click();
    await expect(dialog).toBeHidden();
    await expect(step(page, "ThicknessBlank").getByTestId("completion-badge")).toBeVisible();
    await expect
      .poll(async () => (await storedStep(build.id, "ThicknessBlank"))?.completed)
      .toBe(true);

    await page.reload();
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await expect(step(page, "ThicknessBlank").getByTestId("completion-badge")).toBeVisible();
    await step(page, "ThicknessBlank").click();
    await expect(stepDialog(page).getByText(en.sequence.completedIcon)).toBeAttached();
    await stepDialog(page).getByRole("button", { name: en.sequence.markIncomplete }).click();
    await expect(step(page, "ThicknessBlank").getByTestId("completion-badge")).toHaveCount(0);
    await expect
      .poll(async () => (await storedStep(build.id, "ThicknessBlank"))?.completed)
      .toBe(false);
  });

  test("completes steps in any order", async ({ page }) => {
    await openDiagram(page);
    await step(page, "PressFrets").click();
    await stepDialog(page).getByRole("button", { name: en.sequence.markCompleted }).click();
    await expect(step(page, "PressFrets")).toHaveAttribute("data-status", "completed");
    await expect(step(page, "Fretboard")).toHaveAttribute("data-status", "ready");
  });

  test("saves notes while typing, with line breaks", async ({ page }) => {
    const build = await openDiagram(page);
    await step(page, "CutBraceBlank").click();
    const notes = stepDialog(page).getByLabel(en.sequence.notes);
    await expect(notes).toHaveAttribute("placeholder", en.sequence.notesPlaceholder);
    await notes.fill("Used 3 mm brace stock\nQuartersawn spruce");
    await expect
      .poll(async () => (await storedStep(build.id, "CutBraceBlank"))?.notes)
      .toBe("Used 3 mm brace stock\nQuartersawn spruce");
    await stepDialog(page).getByRole("button", { name: en.sequence.close }).last().click();

    await page.reload();
    await page.getByRole("tab", { name: en.builds.detail.tabSequence }).click();
    await step(page, "CutBraceBlank").click();
    await expect(stepDialog(page).getByLabel(en.sequence.notes)).toHaveValue(
      "Used 3 mm brace stock\nQuartersawn spruce",
    );
  });

  test("keeps notes typed just before completing the step", async ({ page }) => {
    const build = await openDiagram(page);
    await step(page, "ThicknessBlank").click();
    await stepDialog(page)
      .getByLabel(en.sequence.notes)
      .pressSequentially("Planed to 4.2 mm", { delay: 5 });
    await stepDialog(page).getByRole("button", { name: en.sequence.markCompleted }).click();
    await expect
      .poll(async () => storedStep(build.id, "ThicknessBlank"))
      .toMatchObject({ notes: "Planed to 4.2 mm", completed: true });
  });

  test("tells the user when a change cannot be saved", async ({ page }) => {
    await openDiagram(page);
    await fakeSupabase.configure({ failStepChanges: true });
    await step(page, "ThicknessBlank").click();
    await stepDialog(page).getByRole("button", { name: en.sequence.markCompleted }).click();
    await expect(errorToast(page)).toContainText(en.builds.saveFailed);
    await expect(step(page, "ThicknessBlank").getByTestId("completion-badge")).toHaveCount(0);

    await step(page, "CutBraceBlank").click();
    await stepDialog(page).getByLabel(en.sequence.notes).fill("Not lost");
    await expect(errorToast(page).filter({ hasText: en.builds.saveFailed })).not.toHaveCount(0);
    await expect(stepDialog(page).getByLabel(en.sequence.notes)).toHaveValue("Not lost");
  });
});

test.describe("step photos", () => {
  test("uploads several photos after the existing ones and shows them full screen", async ({
    page,
  }) => {
    const build = await openDiagram(page);
    await step(page, "JoinPanels").click();
    const dialog = stepDialog(page);
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
    await page.mouse.click(10, 10);
    await expect(viewer).toBeHidden();
    await expect(stepDialog(page)).toBeVisible();
  });

  test("shows Uploading... while photos upload", async ({ page }) => {
    await openDiagram(page);
    await fakeSupabase.configure({ uploadDelayMs: 1000 });
    await step(page, "JoinPanels").click();
    await stepDialog(page).getByTestId("photo-input").setInputFiles(png("slow.png"));
    await expect(
      stepDialog(page).getByRole("button", { name: en.sequence.photo.uploading }),
    ).toBeDisabled();
    await expect(stepDialog(page).getByRole("img")).toHaveCount(1);
    await expect(
      stepDialog(page).getByRole("button", { name: en.sequence.photo.add }),
    ).toBeEnabled();
  });

  test("keeps the photos that uploaded when others fail", async ({ page }) => {
    await openDiagram(page);
    await fakeSupabase.configure({ failUploadsMatching: "^fail" });
    await step(page, "JoinPanels").click();
    await stepDialog(page)
      .getByTestId("photo-input")
      .setInputFiles([png("one.png"), png("fail.png"), png("three.png")]);
    await expect(errorToast(page)).toContainText(en.sequence.photo.uploadFailed);
    await expect(stepDialog(page).getByRole("img")).toHaveCount(2);

    await stepDialog(page)
      .getByTestId("photo-input")
      .setInputFiles([png("fail-1.png"), png("fail-2.png")]);
    await expect(errorToast(page).filter({ hasText: en.sequence.photo.uploadFailed })).toHaveCount(
      2,
    );
    await expect(stepDialog(page).getByRole("img")).toHaveCount(2);
  });

  test("deletes a photo and its file with one click", async ({ page }) => {
    const build = await openDiagram(page);
    await step(page, "JoinPanels").click();
    await stepDialog(page)
      .getByTestId("photo-input")
      .setInputFiles([png("a.png"), png("b.png"), png("c.png")]);
    await expect(stepDialog(page).getByRole("img")).toHaveCount(3);
    const before = (await storedStep(build.id, "JoinPanels"))?.photos ?? [];
    await stepDialog(page).getByRole("button", { name: "Delete photo 2" }).click();
    await expect(stepDialog(page).getByRole("img")).toHaveCount(2);
    await expect
      .poll(async () =>
        (await storedStep(build.id, "JoinPanels"))?.photos?.map((photo) => photo.name),
      )
      .toEqual([before[0]?.name, before[2]?.name]);
    expect((await fetch(before[1]?.url ?? "")).status).toBe(400);
  });

  test("reports a photo that cannot be deleted and keeps it", async ({ page }) => {
    await openDiagram(page);
    await step(page, "JoinPanels").click();
    await stepDialog(page).getByTestId("photo-input").setInputFiles(png("a.png"));
    await expect(stepDialog(page).getByRole("img")).toHaveCount(1);
    await fakeSupabase.configure({ failStorageRemove: true });
    await stepDialog(page).getByRole("button", { name: "Delete photo 1" }).click();
    await expect(errorToast(page)).toContainText(en.sequence.photo.deleteFailed);
    await expect(stepDialog(page).getByRole("img")).toHaveCount(1);
  });

  test("hides the Camera button on a device without a camera", async ({ page }) => {
    await openDiagram(page);
    await step(page, "JoinPanels").click();
    await expect(
      stepDialog(page).getByRole("button", { name: en.sequence.photo.add }),
    ).toBeVisible();
    await expect(
      stepDialog(page).getByRole("button", { name: en.sequence.photo.camera }),
    ).toHaveCount(0);
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
    await openDiagram(page, seeded);
    await step(page, "TapTestPanels").click();
    const dialog = stepDialog(page);
    await expect(dialog.getByText("Peak: 98.3 Hz")).toBeVisible();
    await expect(dialog.getByText("Peak: 187.4 Hz")).toBeVisible();
    await expect(
      dialog.getByRole("img", { name: "Spectrum of Resonance Analysis, peak at 98.3 Hz" }),
    ).toBeVisible();
    await expect(dialog.getByTestId("peak-marker").first()).toContainText("98.3 Hz");
    await expect(dialog.locator("[data-measurement]").first()).toContainText("Resonance Analysis");
  });

  test("edits a description", async ({ page }) => {
    const build = await openDiagram(page, seeded);
    await step(page, "TapTestPanels").click();
    await stepDialog(page)
      .getByRole("button", { name: "Edit description: Resonance Analysis" })
      .click();
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
    const build = await openDiagram(page, seeded);
    await step(page, "TapTestPanels").click();
    await stepDialog(page)
      .getByRole("button", { name: "Delete sound analysis Second tap" })
      .click();
    let confirm = page.getByRole("dialog", { name: en.sequence.measurement.deleteTitle });
    await expect(confirm).toContainText(en.sequence.measurement.deleteMessage);
    await confirm.getByRole("button", { name: en.dialog.cancel }).click();
    await expect(page.getByText("Peak: 187.4 Hz")).toBeVisible();

    await stepDialog(page)
      .getByRole("button", { name: "Delete sound analysis Second tap" })
      .click();
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
    await openDiagram(page);
    await step(page, "TapTestPanels").click();
    await expect(stepDialog(page)).toContainText(en.sequence.measurement.empty);
  });
});

test.describe("French", () => {
  test("shows the diagram and the step dialog in French", async ({ page }) => {
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
    await page.getByRole("tab", { name: fr.builds.detail.tabSequence }).click();
    await expect(step(page, "TrussRod")).toContainText(fr.steps.TrussRod);
    await step(page, "TapTestPanels").click();
    const dialog = stepDialog(page);
    await expect(dialog).toContainText(fr.steps.TapTestPanels);
    await expect(dialog).toContainText(fr.sequence.notes);
    await expect(dialog).toContainText(fr.sequence.soundAnalysis);
    await expect(dialog.getByRole("button", { name: fr.sequence.markCompleted })).toBeVisible();
    await expect(dialog.getByRole("button", { name: fr.sequence.photo.add })).toBeVisible();
    await expect(dialog.getByText("Pic : 98,3 Hz")).toBeVisible();
  });
});

test.describe("phone layout @phone", () => {
  test("opens the diagram and a step on a phone", async ({ page }) => {
    await openDiagram(page);
    await expect(page.locator(".react-flow__node")).toHaveCount(120);
    await step(page, "TrussRod").click();
    await expect(
      stepDialog(page).getByRole("button", { name: en.sequence.markCompleted }),
    ).toBeVisible();
    await stepDialog(page).getByRole("button", { name: en.sequence.markCompleted }).click();
    await expect(step(page, "TrussRod").getByTestId("completion-badge")).toBeVisible();
  });
});
