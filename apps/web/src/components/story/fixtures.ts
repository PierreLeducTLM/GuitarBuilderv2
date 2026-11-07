// Test data for the story components: stories as parseStory returns them.
import type { StepMeasurement, StepPhoto } from "@gb/db";
import type { StepState, StepStates } from "@/lib/sequence/state";
import type { Story } from "@/lib/story/story";

export const STORY_TOKEN = "dddddddd-0000-4000-8000-00000000000d";

export function storyPhoto(name: string): StepPhoto {
  return { url: `https://example.com/step-photos/build/step/${name}`, name };
}

export function storyMeasurement(overrides: Partial<StepMeasurement> = {}): StepMeasurement {
  return {
    id: "m1",
    timestamp: Date.UTC(2025, 11, 8, 14, 5),
    description: "Top tap",
    frequency: 187.4,
    spectrum: {
      frequencies: [100, 187.4, 300],
      magnitudes: [0.1, 1, 0.2],
      magnitudesDb: [-40, -6, -30],
      sampleRate: 48000,
      fftSize: 8192,
      binWidth: 5.86,
    },
    ...overrides,
  };
}

export function stepState(overrides: Partial<StepState> = {}): StepState {
  return { completed: true, notes: "", photos: [], measurements: [], ...overrides };
}

export function story(overrides: Partial<Story> = {}, states: StepStates = {}): Story {
  return {
    name: "OM #3",
    variant: { guitarType: "steel_string", boboNeck: true },
    createdAt: "2025-12-06T15:30:00Z",
    states,
    ...overrides,
  };
}
