// Coordinates of the spectrum graph (build-sequence: Spectrum Graph). A point at
// frequency f (Hz) and level dB (decibels) sits at x = (f - 20) / 1980 of the plot
// width from the left and y = (-20 - dB) / 80 of the plot height from the top, with
// dB clamped to [-100, -20].
import type { SpectrumRecord } from "@gb/db";

export const SPECTRUM_MIN_HZ = 20;
export const SPECTRUM_MAX_HZ = 2000;
export const SPECTRUM_MIN_DB = -100;
export const SPECTRUM_MAX_DB = -20;
/** Labelled vertical grid lines, Hz. */
export const SPECTRUM_GRID_HZ = [100, 250, 500, 750, 1000, 1500, 2000] as const;
/** Labelled horizontal grid lines, every 20 dB. */
export const SPECTRUM_GRID_DB = [-20, -40, -60, -80, -100] as const;

/** Horizontal position of a frequency, as a fraction of the plot width. */
export function spectrumX(frequency: number): number {
  return (frequency - SPECTRUM_MIN_HZ) / (SPECTRUM_MAX_HZ - SPECTRUM_MIN_HZ);
}

/** Vertical position of a level, from the top, as a fraction of the plot height. */
export function spectrumY(db: number): number {
  const clamped = Math.min(SPECTRUM_MAX_DB, Math.max(SPECTRUM_MIN_DB, db));
  return (SPECTRUM_MAX_DB - clamped) / (SPECTRUM_MAX_DB - SPECTRUM_MIN_DB);
}

export interface PlotPoint {
  x: number;
  y: number;
}

/**
 * The plotted points of a spectrum, in ascending frequency, limited to the axis range
 * (20-2000 Hz), so no point is drawn outside the plot.
 */
export function spectrumPoints(spectrum: SpectrumRecord): PlotPoint[] {
  const points: { f: number; db: number }[] = [];
  const count = Math.min(spectrum.frequencies.length, spectrum.magnitudesDb.length);
  for (let i = 0; i < count; i++) {
    const f = spectrum.frequencies[i] as number;
    const db = spectrum.magnitudesDb[i] as number;
    if (f >= SPECTRUM_MIN_HZ && f <= SPECTRUM_MAX_HZ && Number.isFinite(db)) points.push({ f, db });
  }
  points.sort((a, b) => a.f - b.f);
  return points.map(({ f, db }) => ({ x: spectrumX(f), y: spectrumY(db) }));
}
