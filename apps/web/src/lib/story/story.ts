// A shared build's public story, read from get_build_story (build-story-sharing: Story
// Header, Story Progress, Story Timeline Filtering, Story Empty States).
import { toGuitarType } from "@gb/db";
import {
  isRecord,
  mergeStepState,
  type StepState,
  type StepStates,
  stepState,
} from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import type { BuildVariant, DisplayGraph } from "@/lib/sequence/variant";

export interface Story {
  name: string;
  variant: BuildVariant;
  /** The build's creation time, ISO 8601. */
  createdAt: string;
  states: StepStates;
}

/** The story in the data returned by get_build_story, or null when it is not one. */
export function parseStory(data: unknown): Story | null {
  if (
    !isRecord(data) ||
    typeof data.name !== "string" ||
    typeof data.boboNeck !== "boolean" ||
    typeof data.createdAt !== "string" ||
    !Array.isArray(data.steps)
  ) {
    return null;
  }
  return {
    name: data.name,
    variant: { guitarType: toGuitarType(data.guitarType), boboNeck: data.boboNeck },
    createdAt: data.createdAt,
    states: mergeStepState(data.steps),
  };
}

export interface TimelineStep {
  key: StepKey;
  /** Position in the timeline, from 1. */
  number: number;
  state: StepState;
}

/** Whether a step has non-blank notes, a photo or a measurement. */
function isDocumented(state: StepState): boolean {
  return state.notes.trim() !== "" || state.photos.length > 0 || state.measurements.length > 0;
}

/** The completed, documented steps the build shows, in template order, numbered from 1. */
export function storyTimeline(graph: DisplayGraph, states: StepStates): TimelineStep[] {
  return graph.steps
    .map((step) => ({ key: step.key, state: stepState(states, step.key) }))
    .filter(({ state }) => state.completed && isDocumented(state))
    .map((step, index) => ({ ...step, number: index + 1 }));
}

export type StoryEmptyState = "justStarted" | "noDetails";

/** What replaces an empty timeline, or null when the timeline has steps. */
export function storyEmptyState(graph: DisplayGraph, states: StepStates): StoryEmptyState | null {
  if (storyTimeline(graph, states).length > 0) return null;
  const anyCompleted = graph.steps.some((step) => stepState(states, step.key).completed);
  return anyCompleted ? "noDetails" : "justStarted";
}
