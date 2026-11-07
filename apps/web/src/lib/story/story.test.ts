// build-story-sharing: Story Progress, Story Timeline Filtering, Story Empty States, read
// from the data that get_build_story returns.
import { describe, expect, it } from "vitest";
import { progress } from "@/lib/sequence/state";
import { displayGraph } from "@/lib/sequence/variant";
import { parseStory, type Story, storyEmptyState, storyTimeline } from "./story";

type StoredStep = {
  key: string;
  completed: boolean;
  notes?: string;
  photos?: { url: string; name: string }[];
  measurements?: unknown[];
};

function storyData(overrides: Record<string, unknown> = {}) {
  return {
    name: "OM #3",
    guitarType: "steel_string",
    boboNeck: true,
    createdAt: "2025-12-06T15:30:00+00:00",
    steps: [] as StoredStep[],
    ...overrides,
  };
}

const photo = { url: "https://example.com/step-photos/b/JoinPanels/1_a.jpg", name: "1_a.jpg" };
const measurement = {
  id: "m1",
  timestamp: 1765035000000,
  description: "Top tap",
  frequency: 187.4,
  spectrum: {
    frequencies: [100, 200],
    magnitudes: [0.1, 0.2],
    magnitudesDb: [-20, -14],
    sampleRate: 48000,
    fftSize: 8192,
    binWidth: 5.86,
  },
};

function readStory(steps: StoredStep[], overrides: Record<string, unknown> = {}): Story {
  const story = parseStory(storyData({ steps, ...overrides }));
  if (!story) throw new Error("The story data was not readable");
  return story;
}

const timelineKeys = (story: Story) =>
  storyTimeline(displayGraph(story.variant), story.states).map((step) => step.key);

describe("parseStory", () => {
  it("reads the build's name, variant, creation date and step state", () => {
    const story = readStory([
      { key: "JoinPanels", completed: true, notes: "Glued", photos: [photo] },
    ]);
    expect(story.name).toBe("OM #3");
    expect(story.variant).toEqual({ guitarType: "steel_string", boboNeck: true });
    expect(story.createdAt).toBe("2025-12-06T15:30:00+00:00");
    expect(story.states.JoinPanels).toEqual({
      completed: true,
      notes: "Glued",
      photos: [photo],
      measurements: [],
    });
  });

  it("reads a build whose guitar type is not set", () => {
    expect(readStory([], { guitarType: null, boboNeck: false }).variant).toEqual({
      guitarType: null,
      boboNeck: false,
    });
  });

  it("refuses anything that is not story data", () => {
    expect(parseStory(null)).toBeNull();
    expect(parseStory("OM #3")).toBeNull();
    expect(parseStory(storyData({ name: 3 }))).toBeNull();
    expect(parseStory(storyData({ boboNeck: "yes" }))).toBeNull();
    expect(parseStory(storyData({ createdAt: null }))).toBeNull();
    expect(parseStory(storyData({ steps: "none" }))).toBeNull();
  });
});

describe("storyTimeline", () => {
  it("shows completed steps that have a photo and leaves out undocumented ones", () => {
    const story = readStory([
      { key: "BendSides", completed: true, notes: "", photos: [], measurements: [] },
      { key: "JoinPanels", completed: true, notes: "", photos: [photo], measurements: [] },
    ]);
    expect(timelineKeys(story)).toEqual(["JoinPanels"]);
  });

  it("counts notes, photos and measurements each as documentation", () => {
    const story = readStory([
      { key: "TrussRod", completed: true, notes: "Rod bent." },
      { key: "MakeTrussNut", completed: true, photos: [photo] },
      { key: "MakeTrussBlock", completed: true, measurements: [measurement] },
    ]);
    expect(timelineKeys(story)).toEqual(["TrussRod", "MakeTrussNut", "MakeTrussBlock"]);
  });

  it("leaves out a documented step that is not completed", () => {
    const story = readStory([
      { key: "CarveNeck", completed: false, notes: "Rough carve", photos: [photo] },
    ]);
    expect(timelineKeys(story)).toEqual([]);
  });

  it("leaves out a step whose only content is blank notes", () => {
    const story = readStory([{ key: "JoinPanels", completed: true, notes: "  \n\t " }]);
    expect(timelineKeys(story)).toEqual([]);
  });

  it("leaves out a documented step that the build's variant hides", () => {
    const story = readStory([{ key: "SSCutBridge", completed: true, notes: "Old variant" }], {
      guitarType: "classical",
    });
    expect(timelineKeys(story)).toEqual([]);
  });

  it("lists steps in template order, numbered by their place in the timeline", () => {
    const story = readStory([
      { key: "JoinPanels", completed: true, notes: "Glued" },
      { key: "TrussRod", completed: true, notes: "Rod bent." },
      { key: "MakeTrussBlock", completed: true, photos: [photo] },
    ]);
    const timeline = storyTimeline(displayGraph(story.variant), story.states);
    expect(timeline.map(({ key, number }) => [key, number])).toEqual([
      ["TrussRod", 1],
      ["MakeTrussBlock", 2],
      ["JoinPanels", 3],
    ]);
    expect(timeline[0]?.state.notes).toBe("Rod bent.");
  });
});

describe("storyEmptyState", () => {
  const emptyState = (story: Story) => storyEmptyState(displayGraph(story.variant), story.states);

  it("says the build has just started when no step is completed", () => {
    expect(emptyState(readStory([{ key: "CarveNeck", completed: false, notes: "Soon" }]))).toBe(
      "justStarted",
    );
  });

  it("says no details are shared when steps are completed but none is documented", () => {
    expect(emptyState(readStory([{ key: "BendSides", completed: true }]))).toBe("noDetails");
  });

  it("counts only completed steps that the build's variant shows", () => {
    const story = readStory([{ key: "SSCutBridge", completed: true }], { guitarType: "classical" });
    expect(emptyState(story)).toBe("justStarted");
  });

  it("has no empty state once a step is in the timeline", () => {
    expect(emptyState(readStory([{ key: "JoinPanels", completed: true, notes: "Glued" }]))).toBe(
      null,
    );
  });
});

describe("story progress", () => {
  const storyProgress = (story: Story) => progress(displayGraph(story.variant), story.states);

  it("shows 30 of 120 steps as 25% on a steel-string build with a BOBO neck", () => {
    const graph = displayGraph({ guitarType: "steel_string", boboNeck: true });
    const steps = graph.steps.slice(0, 30).map((step) => ({ key: step.key, completed: true }));
    expect(storyProgress(readStory(steps))).toEqual({ completed: 30, total: 120, percent: 25 });
  });

  it("ignores a completed step that the variant hides", () => {
    const graph = displayGraph({ guitarType: "classical", boboNeck: true });
    const steps = [
      ...graph.steps.slice(0, 12).map((step) => ({ key: step.key, completed: true })),
      { key: "SSCutBridge", completed: true },
    ];
    expect(storyProgress(readStory(steps, { guitarType: "classical" }))).toMatchObject({
      completed: 12,
      total: 120,
    });
  });

  it("shows 0 of 112 steps as 0% on a fresh classical build without a BOBO neck", () => {
    const story = readStory([], { guitarType: "classical", boboNeck: false });
    expect(storyProgress(story)).toEqual({ completed: 0, total: 112, percent: 0 });
  });
});
