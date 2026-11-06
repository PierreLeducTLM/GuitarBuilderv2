import type { SpectrumRecord } from "@gb/db";
import { describe, expect, it } from "vitest";
import { convertSteps, nodeHasData } from "./steps.ts";

const spectrum = (count = 3): SpectrumRecord => ({
  frequencies: Array.from({ length: count }, (_, i) => 20 + i * 0.5),
  magnitudes: Array.from({ length: count }, (_, i) => (i === 1 ? 0.5 : 0.001)),
  magnitudesDb: Array.from({ length: count }, (_, i) => (i === 1 ? -6 : -60)),
  sampleRate: 16384,
  fftSize: 32768,
  binWidth: 0.5,
});

const analysis = (overrides: Record<string, unknown> = {}) => ({
  id: "1733500000000",
  timestamp: 1733500000000,
  description: "Top tap",
  peakFrequency: 182.5,
  fftData: spectrum(),
  ...overrides,
});

const node = (overrides: Record<string, unknown> = {}) => ({
  id: "ThicknessBlank",
  completed: false,
  notes: "",
  photos: [],
  fftAnalyses: [],
  ...overrides,
});

describe("nodeHasData", () => {
  it.each([
    ["completed", node({ completed: true }), true],
    ["with notes", node({ notes: "glued" }), true],
    ["with a photo", node({ photos: [{ url: "u", fileName: "f" }] }), true],
    ["with a measurement", node({ fftAnalyses: [analysis()] }), true],
    ["empty", node(), false],
    ["with blank notes", node({ notes: "  \n " }), false],
    ["with a truthy non-boolean completion", node({ completed: "yes" }), false],
    ["with odd fields", node({ notes: 3, photos: "x", fftAnalyses: {} }), false],
  ])("is %s → %s", (_label, value, expected) => {
    expect(nodeHasData(value)).toBe(expected);
  });
});

describe("convertSteps", () => {
  it("converts completion, exact notes and measurements of each node with data", () => {
    const result = convertSteps({
      nodes: [
        node({ id: "TrussRod", completed: true, notes: "  Two-way rod\n" }),
        node({ id: "Bracing", fftAnalyses: [analysis()] }),
      ],
    });

    expect(result.steps).toEqual([
      {
        entry: {
          key: "TrussRod",
          completed: true,
          notes: "  Two-way rod\n",
          photos: [],
          measurements: [],
        },
        legacyPhotos: [],
      },
      {
        entry: {
          key: "Bracing",
          completed: false,
          notes: "",
          photos: [],
          measurements: [
            {
              id: "1733500000000",
              timestamp: 1733500000000,
              description: "Top tap",
              frequency: 182.5,
              spectrum: spectrum(),
            },
          ],
        },
        legacyPhotos: [],
      },
    ]);
    expect(result.notes).toEqual([]);
  });

  it("leaves out nodes without data", () => {
    expect(convertSteps({ nodes: [node(), node({ id: "Other", notes: " " })] }).steps).toEqual([]);
  });

  it("keeps step keys the template does not know", () => {
    const result = convertSteps({ nodes: [node({ id: "OldCustomStep", completed: true })] });

    expect(result.steps.map((step) => step.entry.key)).toEqual(["OldCustomStep"]);
  });

  it("carries the legacy photos for copying, in order", () => {
    const photos = [
      { url: "https://x/step-photos/b/TrussRod/1_a.jpg", fileName: "b/TrussRod/1_a.jpg" },
      { url: "https://x/step-photos/b/TrussRod/2_b.jpg", fileName: "b/TrussRod/2_b.jpg" },
    ];

    const [step] = convertSteps({ nodes: [node({ id: "TrussRod", photos })] }).steps;

    expect(step?.legacyPhotos).toEqual(photos);
    expect(step?.entry.photos).toEqual([]);
  });

  it("names a measurement with a blank or missing description Untitled Analysis", () => {
    const [step] = convertSteps({
      nodes: [
        node({
          fftAnalyses: [
            analysis({ id: "a", description: "   " }),
            analysis({ id: "b", description: undefined }),
          ],
        }),
      ],
    }).steps;

    expect(step?.entry.measurements.map((m) => m.description)).toEqual([
      "Untitled Analysis",
      "Untitled Analysis",
    ]);
  });

  it("keeps a measurement graph's data unchanged", () => {
    const original = spectrum(300);

    const [step] = convertSteps({
      nodes: [node({ fftAnalyses: [analysis({ fftData: original })] })],
    }).steps;

    expect(step?.entry.measurements[0]?.spectrum).toEqual(original);
  });

  it("reduces an oversized spectrum and reports it, keeping the measurement's frequency", () => {
    const result = convertSteps({
      nodes: [node({ id: "Bracing", fftAnalyses: [analysis({ fftData: spectrum(1366) })] })],
    });

    const measurement = result.steps[0]?.entry.measurements[0];
    expect(measurement?.frequency).toBe(182.5);
    expect(measurement?.spectrum.frequencies).toHaveLength(683);
    expect(result.notes).toEqual([
      {
        kind: "spectrum-reduced",
        step: "Bracing",
        measurement: "1733500000000",
        from: 1366,
        to: 683,
      },
    ]);
  });

  it.each([
    ["without a spectrum", analysis({ fftData: undefined }), "not a spectrum record"],
    [
      "with mismatched lists",
      analysis({ fftData: { ...spectrum(), magnitudes: [1] } }),
      "lists of different lengths",
    ],
    ["without a peak frequency", analysis({ peakFrequency: null }), "no peak frequency"],
    ["with a zero peak frequency", analysis({ peakFrequency: 0 }), "no peak frequency"],
    ["with a peak frequency as text", analysis({ peakFrequency: "182.5" }), "no peak frequency"],
    ["without a capture time", analysis({ timestamp: "yesterday" }), "no capture time"],
    ["without an identifier", analysis({ id: 7 }), "no identifier"],
    ["with a blank identifier", analysis({ id: "" }), "no identifier"],
  ])("skips and reports a measurement %s", (_label, measurement, reason) => {
    const result = convertSteps({
      nodes: [node({ id: "Bracing", completed: true, fftAnalyses: [measurement] })],
    });

    expect(result.steps[0]?.entry.measurements).toEqual([]);
    expect(result.notes).toEqual([
      {
        kind: "measurement-skipped",
        step: "Bracing",
        measurement: typeof measurement.id === "string" ? measurement.id : "",
        reason,
      },
    ]);
  });

  it("skips a measurement that is not an object", () => {
    const result = convertSteps({ nodes: [node({ id: "Bracing", fftAnalyses: [null] })] });

    expect(result.notes).toEqual([
      {
        kind: "measurement-skipped",
        step: "Bracing",
        measurement: "",
        reason: "not a measurement",
      },
    ]);
  });

  it("keeps the first of two nodes with the same key and reports the other", () => {
    const result = convertSteps({
      nodes: [node({ id: "TrussRod", completed: true }), node({ id: "TrussRod", notes: "second" })],
    });

    expect(result.steps.map((step) => step.entry.completed)).toEqual([true]);
    expect(result.notes).toEqual([{ kind: "duplicate-step", step: "TrussRod" }]);
  });

  it("reports a node without a key", () => {
    const result = convertSteps({ nodes: [node({ id: 4, completed: true }), "junk"] });

    expect(result.steps).toEqual([]);
    expect(result.notes).toEqual([{ kind: "step-without-key" }, { kind: "step-without-key" }]);
  });

  it.each([
    ["a missing diagram", undefined],
    ["a null diagram", null],
    ["a diagram without nodes", {}],
    ["nodes that are not a list", { nodes: "x" }],
  ])("reads %s as no steps", (_label, diagram) => {
    expect(convertSteps(diagram)).toEqual({ steps: [], notes: [] });
  });
});
