// @vitest-environment jsdom
import { act, renderHook, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { displayGraph } from "@/lib/sequence/variant";
import { renderWithIntl } from "@/test/intl";
import { STORY_TOKEN, stepState, story, storyPhoto } from "./fixtures";
import { StoryView } from "./StoryView";
import { useStory } from "./useStory";

const browser = vi.hoisted(() => ({
  answer: { data: null as unknown, error: null as unknown },
  calls: [] as unknown[],
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (fn: string, args: unknown) => {
      browser.calls.push([fn, args]);
      return Promise.resolve(browser.answer);
    },
  }),
}));

function firstSteps(count: number) {
  return Object.fromEntries(
    displayGraph({ guitarType: "steel_string", boboNeck: true })
      .steps.slice(0, count)
      .map((step) => [step.key, stepState()]),
  );
}

describe("StoryView", () => {
  it("shows the label, the build name and the start date", () => {
    renderWithIntl(<StoryView story={story()} />);
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Build Story")).toBeTruthy();
    expect(within(header).getByRole("heading", { level: 1, name: "OM #3" })).toBeTruthy();
    expect(within(header).getByText("Started December 6, 2025")).toBeTruthy();
  });

  it("shows the build's progress over the steps that apply", () => {
    renderWithIntl(<StoryView story={story({}, firstSteps(30))} />);
    expect(screen.getByText("Build Progress")).toBeTruthy();
    expect(screen.getByText("30 of 120 steps")).toBeTruthy();
    expect(screen.getByText("25% Complete")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Build Progress" });
    expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemax")]).toEqual([
      "30",
      "120",
    ]);
  });

  it("says the build has just started when nothing is completed", () => {
    renderWithIntl(
      <StoryView story={story({ variant: { guitarType: "classical", boboNeck: false } })} />,
    );
    expect(screen.getByText("0 of 112 steps")).toBeTruthy();
    expect(screen.getByText("0% Complete")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Build Just Started" })).toBeTruthy();
    expect(
      screen.getByText("No steps have been completed yet. Check back soon to see the progress!"),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Timeline" })).toBeNull();
  });

  it("says no details are shared yet when completed steps are undocumented", () => {
    renderWithIntl(<StoryView story={story({}, firstSteps(3))} />);
    expect(screen.getByRole("heading", { name: "No Details Shared Yet" })).toBeTruthy();
    expect(
      screen.getByText(
        "Work is in progress, but no specific steps have been documented with photos or notes yet.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Build Just Started" })).toBeNull();
  });

  it("lists the documented completed steps as a numbered timeline", () => {
    const states = {
      JoinPanels: stepState({ photos: [storyPhoto("1_a.jpg")] }),
      TrussRod: stepState({ notes: "Rod bent." }),
      BendSides: stepState(),
    };
    renderWithIntl(<StoryView story={story({}, states)} />);
    const items = within(screen.getByRole("list", { name: "Timeline" })).getAllByRole("listitem");
    expect(
      items.map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(["Truss rod", "Join panels"]);
    expect(within(items[1] as HTMLElement).getByText("Step 2")).toBeTruthy();
    expect(screen.queryByText("Bend sides")).toBeNull();
    expect(screen.queryByRole("heading", { name: "No Details Shared Yet" })).toBeNull();
  });

  it("shows nothing about the owner and no way to change the build or enter the app", () => {
    renderWithIntl(<StoryView story={story({}, { TrussRod: stepState({ notes: "Hi" }) })} />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.body.textContent).not.toMatch(/@|owner/i);
  });

  it("is in French", () => {
    renderWithIntl(<StoryView story={story({}, firstSteps(30))} />, {
      locale: "fr",
    });
    expect(screen.getByText("Histoire de la fabrication")).toBeTruthy();
    expect(screen.getByText("Commencée le 6 décembre 2025")).toBeTruthy();
    expect(screen.getByText("30 étapes sur 120")).toBeTruthy();
    expect(screen.getByText("25 % terminé")).toBeTruthy();
  });
});

describe("useStory", () => {
  const STORED = {
    name: "OM #3 (renamed)",
    guitarType: "steel_string",
    boboNeck: true,
    createdAt: "2025-12-06T15:30:00Z",
    steps: [{ key: "TrussRod", completed: true, notes: "Rod bent." }],
  };

  it("fetches the story again with its token", async () => {
    browser.calls = [];
    browser.answer = { data: STORED, error: null };
    const { result } = renderHook(() => useStory(STORY_TOKEN, story()));
    await act(() => result.current.refresh());
    expect(browser.calls).toEqual([["get_build_story", { p_token: STORY_TOKEN }]]);
    expect(result.current.story?.name).toBe("OM #3 (renamed)");
    expect(result.current.story?.states.TrussRod?.notes).toBe("Rod bent.");
  });

  it("turns into Story Not Found when the link stops opening the story", async () => {
    browser.answer = { data: null, error: null };
    const { result } = renderHook(() => useStory(STORY_TOKEN, story()));
    await act(() => result.current.refresh());
    expect(result.current.story).toBeNull();
  });

  it("keeps the current story when a refresh fails", async () => {
    browser.answer = { data: null, error: { code: "500" } };
    const { result } = renderHook(() => useStory(STORY_TOKEN, story()));
    await act(() => result.current.refresh());
    expect(result.current.story?.name).toBe("OM #3");
  });
});

describe("StoryView without a story", () => {
  it("shows Story Not Found once the link stops opening the story", () => {
    renderWithIntl(<StoryView story={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Story Not Found" })).toBeTruthy();
    expect(screen.getByText("Build not found or sharing has been disabled.")).toBeTruthy();
  });
});
