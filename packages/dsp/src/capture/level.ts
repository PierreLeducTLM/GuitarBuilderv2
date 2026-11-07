import { CLIP_LEVEL } from "../tapTone/constants.ts";
import { detectTaps, noiseFloor } from "../tapTone/taps.ts";

const LOW_PEAK = 0.05;
const DB_FLOOR_LEVEL = 1e-10;

type Samples = Float64Array | Float32Array;

export type LevelVerdict = "noTap" | "clipping" | "low" | "good";

export type CheckLevel = {
  readonly verdict: LevelVerdict;
  readonly noiseFloorDb: number;
  readonly peakDb: number;
};

const dbfs = (level: number) => 20 * Math.log10(Math.max(level, DB_FLOOR_LEVEL));

const peakOf = (signal: Samples) => {
  let peak = 0;
  for (const x of signal) peak = Math.max(peak, Math.abs(x));
  return peak;
};

const verdictOf = (peak: number, tapped: boolean): LevelVerdict => {
  if (!tapped) return "noTap";
  if (peak >= CLIP_LEVEL) return "clipping";
  if (peak < LOW_PEAK) return "low";
  return "good";
};

export const measureLevel = (input: { raw: Samples; filtered: Samples }): CheckLevel => {
  const peak = peakOf(input.raw);
  const tapped = detectTaps({ filtered: input.filtered, raw: [input.raw] }).length > 0;
  return {
    verdict: verdictOf(peak, tapped),
    noiseFloorDb: dbfs(noiseFloor(input.raw)),
    peakDb: dbfs(peak),
  };
};
