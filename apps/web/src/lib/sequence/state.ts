// A build's step state and the figures derived from it (build-sequence: Step State
// Loading, Ready Steps, Hidden Step Data; guitar-builds: Build Summary Strip;
// build-story-sharing: Story Progress).
import type {
  BodyRole,
  MeasurementRoles,
  SpectrumRecord,
  StepEntry,
  StepMeasurement,
  StepPhoto,
} from "@gb/db";
import { isStepKey, type StepKey } from "./template";
import type { DisplayGraph } from "./variant";

/** One step's state as the app uses it: an entry without its key. */
export type StepState = Omit<StepEntry, "key">;

/** State of every template step that has stored data; missing steps are empty. */
export type StepStates = Partial<Record<StepKey, StepState>>;

export const EMPTY_STEP_STATE: StepState = Object.freeze({
  completed: false,
  notes: "",
  photos: [],
  measurements: [],
}) as StepState;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberList(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "number") ? value : null;
}

function toPhoto(value: unknown): StepPhoto | null {
  if (!isRecord(value) || typeof value.url !== "string" || typeof value.name !== "string") {
    return null;
  }
  return { url: value.url, name: value.name };
}

function toSpectrum(value: unknown): SpectrumRecord | null {
  if (!isRecord(value)) return null;
  const frequencies = numberList(value.frequencies);
  const magnitudes = numberList(value.magnitudes);
  const magnitudesDb = numberList(value.magnitudesDb);
  const { sampleRate, fftSize, binWidth } = value;
  if (
    !frequencies ||
    !magnitudes ||
    !magnitudesDb ||
    typeof sampleRate !== "number" ||
    typeof fftSize !== "number" ||
    typeof binWidth !== "number"
  ) {
    return null;
  }
  return { frequencies, magnitudes, magnitudesDb, sampleRate, fftSize, binWidth };
}

const ROLE_NAMES = ["air", "top", "back"] as const;

const isOptionalNumber = (value: unknown): value is number | null =>
  value === null || typeof value === "number";

function toRole(value: unknown): BodyRole | null {
  if (
    !isRecord(value) ||
    typeof value.frequency !== "number" ||
    typeof value.level !== "number" ||
    !isOptionalNumber(value.spectralQ) ||
    !isOptionalNumber(value.decayQ) ||
    (value.origin !== "auto" && value.origin !== "user")
  ) {
    return null;
  }
  return {
    frequency: value.frequency,
    level: value.level,
    spectralQ: value.spectralQ,
    decayQ: value.decayQ,
    origin: value.origin,
  };
}

function toRoles(value: unknown): MeasurementRoles | null {
  if (!isRecord(value)) return null;
  const entries = ROLE_NAMES.flatMap((name) => {
    const role = toRole(value[name]);
    return role ? [[name, role] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function toMeasurement(value: unknown): StepMeasurement | null {
  if (!isRecord(value)) return null;
  const spectrum = toSpectrum(value.spectrum);
  if (
    typeof value.id !== "string" ||
    typeof value.timestamp !== "number" ||
    typeof value.description !== "string" ||
    typeof value.frequency !== "number" ||
    !spectrum
  ) {
    return null;
  }
  const roles = toRoles(value.roles);
  return {
    id: value.id,
    timestamp: value.timestamp,
    description: value.description,
    frequency: value.frequency,
    spectrum,
    ...(roles ? { roles } : {}),
  };
}

function compact<T>(list: (T | null)[]): T[] {
  return list.filter((item): item is T => item !== null);
}

/**
 * One stored entry read leniently: a missing or malformed field is empty, and
 * malformed photos or measurements are skipped.
 */
export function toStepState(value: unknown): StepState {
  if (!isRecord(value)) return EMPTY_STEP_STATE;
  return {
    completed: value.completed === true,
    notes: typeof value.notes === "string" ? value.notes : "",
    photos: Array.isArray(value.photos) ? compact(value.photos.map(toPhoto)) : [],
    measurements: Array.isArray(value.measurements)
      ? compact(value.measurements.map(toMeasurement))
      : [],
  };
}

/**
 * The stored step state merged onto the template by key (Step State Loading): entries
 * whose key is not in the template are ignored, and template steps without an entry
 * are empty (see `stepState`).
 */
export function mergeStepState(stored: unknown): StepStates {
  const states: StepStates = {};
  if (!Array.isArray(stored)) return states;
  for (const entry of stored) {
    if (isRecord(entry) && typeof entry.key === "string" && isStepKey(entry.key)) {
      states[entry.key] ??= toStepState(entry);
    }
  }
  return states;
}

export function stepState(states: StepStates, key: StepKey): StepState {
  return states[key] ?? EMPTY_STEP_STATE;
}

export type StepStatus = "completed" | "ready" | "notStarted";

/**
 * Completed; ready (not completed, and every displayed predecessor completed, which
 * includes starting steps); or not started.
 */
export function stepStatus(graph: DisplayGraph, states: StepStates, key: StepKey): StepStatus {
  if (stepState(states, key).completed) return "completed";
  const predecessors = graph.predecessors.get(key) ?? [];
  return predecessors.every((from) => stepState(states, from).completed) ? "ready" : "notStarted";
}

export interface Progress {
  /** Completed steps among those that apply. */
  completed: number;
  /** Steps that apply to the build's variant. */
  total: number;
  /** round(100 × completed / total). */
  percent: number;
}

/** "<C> of <T> steps · <P>%", counting only the steps the build shows. */
export function progress(graph: DisplayGraph, states: StepStates): Progress {
  const total = graph.steps.length;
  const completed = graph.steps.filter((step) => stepState(states, step.key).completed).length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((100 * completed) / total) };
}

/** The first ready step in template order, or null when every step is done. */
export function nextUp(graph: DisplayGraph, states: StepStates): StepKey | null {
  const step = graph.steps.find(
    (candidate) => stepStatus(graph, states, candidate.key) === "ready",
  );
  return step?.key ?? null;
}

/** The most recently recorded measurement among the steps the build shows. */
export function latestMeasurement(graph: DisplayGraph, states: StepStates): StepMeasurement | null {
  let latest: StepMeasurement | null = null;
  for (const step of graph.steps) {
    for (const measurement of stepState(states, step.key).measurements) {
      if (!latest || measurement.timestamp > latest.timestamp) latest = measurement;
    }
  }
  return latest;
}
