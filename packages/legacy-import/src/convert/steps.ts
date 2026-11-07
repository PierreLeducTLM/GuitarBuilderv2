import type { StepEntry, StepMeasurement } from "@gb/db";
import { prepareSpectrum } from "./spectrum.ts";

export const UNTITLED_ANALYSIS = "Untitled Analysis";

export type StepNote =
  | { kind: "spectrum-reduced"; step: string; measurement: string; from: number; to: number }
  | { kind: "measurement-skipped"; step: string; measurement: string; reason: string }
  | { kind: "duplicate-step"; step: string }
  | { kind: "step-without-key" };

/** A converted step: its v2 entry (photos still to copy) and the legacy photos to copy. */
export type ConvertedStep = { entry: StepEntry; legacyPhotos: readonly unknown[] };

export type ConvertedSteps = { steps: ConvertedStep[]; notes: StepNote[] };

type Node = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Node => typeof value === "object" && value !== null;

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

/** build-sequence: a step has data when completed or with notes, a photo or a measurement. */
export function nodeHasData(node: Node): boolean {
  return (
    node.completed === true ||
    textOf(node.notes).trim() !== "" ||
    listOf(node.photos).length > 0 ||
    listOf(node.fftAnalyses).length > 0
  );
}

type MeasurementResult =
  | { measurement: StepMeasurement; note: StepNote | null }
  | { measurement: null; note: StepNote };

const convertMeasurement = (step: string, value: unknown): MeasurementResult => {
  const skip = (measurement: string, reason: string): MeasurementResult => ({
    measurement: null,
    note: { kind: "measurement-skipped", step, measurement, reason },
  });
  if (!isObject(value)) return skip("", "not a measurement");
  const id = textOf(value.id);
  if (id === "") return skip("", "no identifier");
  const { timestamp, peakFrequency } = value;
  if (typeof timestamp !== "number") return skip(id, "no capture time");
  if (typeof peakFrequency !== "number" || peakFrequency <= 0) {
    return skip(id, "no peak frequency");
  }
  const prepared = prepareSpectrum(value.fftData);
  if (prepared.kind === "refused") return skip(id, prepared.reason);
  const description =
    textOf(value.description).trim() === "" ? UNTITLED_ANALYSIS : textOf(value.description);
  return {
    measurement: {
      id,
      timestamp,
      description,
      frequency: peakFrequency,
      spectrum: prepared.record,
    },
    note:
      prepared.kind === "reduced"
        ? { kind: "spectrum-reduced", step, measurement: id, from: prepared.from, to: prepared.to }
        : null,
  };
};

const convertNode = (key: string, node: Node): { step: ConvertedStep; notes: StepNote[] } => {
  const results = listOf(node.fftAnalyses).map((value) => convertMeasurement(key, value));
  return {
    step: {
      entry: {
        key,
        completed: node.completed === true,
        notes: textOf(node.notes),
        photos: [],
        measurements: results.flatMap((result) => (result.measurement ? [result.measurement] : [])),
      },
      legacyPhotos: listOf(node.photos),
    },
    notes: results.flatMap((result) => (result.note ? [result.note] : [])),
  };
};

/**
 * Converts a legacy `sequence_diagram` into v2 step entries (legacy-data-migration: Build
 * Migration, Step Measurement Migration). Only nodes with data become entries; an absent
 * entry reads as empty in v2.
 */
export function convertSteps(diagram: unknown): ConvertedSteps {
  const nodes = isObject(diagram) ? listOf(diagram.nodes) : [];
  const keyless: StepNote[] = nodes
    .filter((node) => !isObject(node) || textOf(node.id) === "")
    .map(() => ({ kind: "step-without-key" }));
  const withData = nodes.filter(
    (node): node is Node => isObject(node) && textOf(node.id) !== "" && nodeHasData(node),
  );
  const firstIndex = (key: string): number => withData.findIndex((node) => node.id === key);
  const converted = withData.map((node, index) => {
    const key = textOf(node.id);
    return index === firstIndex(key)
      ? convertNode(key, node)
      : { step: null, notes: [{ kind: "duplicate-step", step: key } satisfies StepNote] };
  });
  return {
    steps: converted.flatMap((item) => (item.step ? [item.step] : [])),
    notes: [...keyless, ...converted.flatMap((item) => item.notes)],
  };
}
