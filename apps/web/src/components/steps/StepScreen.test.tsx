// @vitest-environment jsdom
import type { StepChange } from "@gb/db";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { EMPTY_STEP_STATE, type StepStates } from "@/lib/sequence/state";
import { StepStore } from "@/lib/sequence/store";
import type { StepKey } from "@/lib/sequence/template";
import { displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { StepScreen } from "./StepScreen";

Object.assign(window, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

const steelPlain = displayGraph({ guitarType: "steel_string", boboNeck: false });
const completed = (...keys: readonly StepKey[]): StepStates =>
  Object.fromEntries(keys.map((key) => [key, { ...EMPTY_STEP_STATE, completed: true }]));

/** A store whose saves succeed at once and are recorded. */
function savingStore(initial: StepStates = {}) {
  const saved: { key: StepKey; change: StepChange }[] = [];
  const store = new StepStore({
    initial,
    save: async (key, change) => {
      saved.push({ key, change });
      return {
        key,
        ...EMPTY_STEP_STATE,
        completed: change.op === "set_completed" ? change.completed : false,
      };
    },
    onSaveFailed: () => undefined,
  });
  return { store, saved };
}

type Props = ComponentProps<typeof StepScreen>;

/** Renders the screen with the store's live state, as the build page does. */
function Live(props: Omit<Props, "states">) {
  const states = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot);
  return <StepScreen {...props} states={states} />;
}

function renderStep(
  stepKey: StepKey,
  {
    states = {},
    canEdit = true,
    from,
    locale,
  }: { states?: StepStates; canEdit?: boolean; from?: Props["from"]; locale?: TestLocale } = {},
) {
  const { store, saved } = savingStore(states);
  const onNavigate = vi.fn();
  const view = renderWithIntl(
    <AppProviders>
      <Live
        buildId="b1"
        stepKey={stepKey}
        graph={steelPlain}
        store={store}
        canEdit={canEdit}
        from={from}
        onNavigate={onNavigate}
      />
    </AppProviders>,
    { locale },
  );
  return { store, saved, onNavigate, unmount: view.unmount };
}

describe("StepScreen", () => {
  it("shows the step number, its group and its label", () => {
    renderStep("FitTopBack");
    expect(screen.getByText("Step 115")).toBeTruthy();
    expect(screen.getByText("Body assembly")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Fit top and back" })).toBeTruthy();
  });

  it("shows a check beside the title of a completed step", () => {
    renderStep("TrussRod", { states: completed("TrussRod") });
    expect(screen.getByRole("heading", { level: 2, name: /^Truss rod\s*Completed$/ })).toBeTruthy();
  });

  it("names what the step comes after, marked done, and what it leads to in another part", () => {
    renderStep("BindRod", { states: completed("AssembleParts") });
    const after = screen.getByRole("list", { name: "After" });
    expect(within(after).getByRole("link").textContent).toBe("Assemble partsCompleted");
    expect(within(after).getByRole("link").getAttribute("href")).toBe(
      "/builds/b1/steps/AssembleParts",
    );
    const leadsTo = screen.getByRole("list", { name: "Leads to" });
    expect(within(leadsTo).getByRole("link").textContent).toBe(
      "Assemble neck, rod, fretboard (Neck assembly)",
    );
  });

  it("keeps where the step was opened from in the steps it links to", () => {
    renderStep("CutBendRod", { from: "truss-rod" });
    expect(
      within(screen.getByRole("list", { name: "Leads to" }))
        .getByRole("link")
        .getAttribute("href"),
    ).toBe("/builds/b1/steps/ThreadRod?from=truss-rod");
  });

  it("reads a starting step as the start of its group", () => {
    renderStep("TrussRod");
    expect(screen.getByText("Starting step of Truss rod")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "After" })).toBeNull();
  });

  it("reads the final step as the last of the build", () => {
    renderStep("OptimiseAcoustic");
    expect(screen.getByText("Last step of the build")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Leads to" })).toBeNull();
  });

  it("does not repeat the generic sequence hint", () => {
    renderStep("TrussRod");
    expect(screen.queryByText(/Follow the sequence/)).toBeNull();
  });

  it("has the Notes, Photos and Sound Analysis sections", () => {
    renderStep("TrussRod");
    expect(screen.getByPlaceholderText("Add notes about this step...")).toBe(
      screen.getByLabelText("Notes"),
    );
    expect(screen.getByRole("region", { name: "Photos" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Sound Analysis" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Step navigation" })).toBeTruthy();
  });

  it("saves notes still being typed when the screen is left", async () => {
    const { saved, unmount } = renderStep("TrussRod");
    await userEvent.type(screen.getByLabelText("Notes"), "PTFE");
    expect(saved).toEqual([]);
    unmount();
    await Promise.resolve();
    expect(saved).toEqual([{ key: "TrussRod", change: { op: "set_notes", notes: "PTFE" } }]);
  });

  it("returns to the Steps view, or to the part it was opened from", () => {
    renderStep("TrussRod");
    expect(screen.getByRole("link", { name: "Steps" }).getAttribute("href")).toBe("/builds/b1");
  });

  it("returns to the part flow it was opened from", () => {
    renderStep("InlayRosette", { from: "top-panel" });
    expect(screen.getByRole("link", { name: "Top panel" }).getAttribute("href")).toBe(
      "/builds/b1/map/top-panel",
    );
  });

  it("completes the step and moves to the next ready step", async () => {
    const { saved, onNavigate } = renderStep("CutRectangle", { states: completed("TopPanel") });
    await userEvent.click(screen.getByRole("button", { name: "Done, next step" }));
    expect(saved).toEqual([
      { key: "CutRectangle", change: { op: "set_completed", completed: true } },
    ]);
    expect(onNavigate).toHaveBeenCalledWith("ReduceThickness");
  });

  it("goes back to the Steps view when the last remaining step is done", async () => {
    const all = steelPlain.steps.map((step) => step.key).filter((key) => key !== "BindRod");
    const { onNavigate } = renderStep("BindRod", { states: completed(...all) });
    await userEvent.click(screen.getByRole("button", { name: "Done, next step" }));
    expect(onNavigate).toHaveBeenCalledWith(null);
  });

  it("reopens a completed step and stays on it", async () => {
    const { saved, onNavigate } = renderStep("TrussRod", { states: completed("TrussRod") });
    expect(screen.queryByRole("button", { name: "Done, next step" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mark as Incomplete" }));
    expect(saved).toEqual([{ key: "TrussRod", change: { op: "set_completed", completed: false } }]);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("moves to the previous and next displayed steps", async () => {
    const { onNavigate } = renderStep("Crown");
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(onNavigate).toHaveBeenLastCalledWith("RoutNut");
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(onNavigate).toHaveBeenLastCalledWith("TaperFret");
  });

  it("cannot go before the first step or after the last", () => {
    renderStep("TrussRod");
    expect(
      (screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("cannot go past the last step", () => {
    renderStep("OptimiseAcoustic");
    expect((screen.getByRole("button", { name: "Next step" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("saves typed notes through the store", async () => {
    const { store } = renderStep("TrussRod");
    await userEvent.type(screen.getByLabelText("Notes"), "PTFE");
    expect(store.getSnapshot().TrussRod?.notes).toBe("PTFE");
  });

  it("shows another user's step read-only, without completion controls", () => {
    renderStep("TrussRod", { canEdit: false });
    expect((screen.getByLabelText("Notes") as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "Done, next step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark as Incomplete" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
  });

  it("is in French", () => {
    renderStep("TrussRod", { locale: "fr" });
    expect(screen.getByRole("heading", { level: 2, name: "Tige de réglage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminée, étape suivante" })).toBeTruthy();
  });
});
