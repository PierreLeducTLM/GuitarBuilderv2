import type { SpectrumRecord } from "./steps.ts";

/** The three frequency fields of a wood panel, as keys of its stored spectra. */
export const WOOD_SPECTRUM_KEYS = ["longitudinal", "crossGrain", "diagonal"] as const;
export type WoodSpectrumKey = (typeof WOOD_SPECTRUM_KEYS)[number];

/** A panel's spectra (wood-panel-properties: Tap-Tone Spectrum Storage), at most one per field. */
export type WoodPanelSpectra = Partial<Record<WoodSpectrumKey, SpectrumRecord>>;
