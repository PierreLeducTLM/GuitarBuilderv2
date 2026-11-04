import type { SpectrumPoint } from "./spectrum.ts";

export type TapToneRecord = {
  readonly frequencies: readonly number[];
  readonly magnitudes: readonly number[];
  readonly magnitudesDb: readonly number[];
  readonly sampleRate: number;
  readonly fftSize: number;
  readonly binWidth: number;
};

export const recordFromPoints = (
  points: readonly SpectrumPoint[],
  analysis: { sampleRate: number; fftSize: number },
): TapToneRecord => ({
  frequencies: points.map((p) => p.frequency),
  magnitudes: points.map((p) => p.magnitude),
  magnitudesDb: points.map((p) => p.db),
  sampleRate: analysis.sampleRate,
  fftSize: analysis.fftSize,
  binWidth: analysis.sampleRate / analysis.fftSize,
});

export const pointsFromRecord = (record: TapToneRecord): readonly SpectrumPoint[] =>
  record.frequencies.map((frequency, i) => ({
    frequency,
    magnitude: record.magnitudes[i] ?? 0,
    db: record.magnitudesDb[i] ?? 0,
  }));
