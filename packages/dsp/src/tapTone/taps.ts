import {
  CLIP_CHECK_SAMPLES,
  CLIP_LEVEL,
  MAX_TAPS,
  MIN_SAMPLES_AFTER_ONSET,
  TAP_BLOCK_SAMPLES,
  TAP_DEBOUNCE_BLOCKS,
  TAP_MIN_LEVEL,
  TAP_NOISE_MARGIN,
  TAP_NOISE_PERCENTILE,
  TAP_RISE_BLOCKS,
  TAP_RISE_RATIO,
  TAP_WINDOW_LEAD_SAMPLES,
  TAP_WINDOW_SAMPLES,
} from "./constants.ts";

export type TapRejection = "clipped" | "tooClose" | "cutOff";

export type Tap = {
  readonly number: number;
  readonly onset: number;
  readonly rejection: TapRejection | null;
};

type Samples = Float64Array | Float32Array;

const blockLevels = (signal: Samples): readonly number[] =>
  Array.from({ length: Math.floor(signal.length / TAP_BLOCK_SAMPLES) }, (_, b) => {
    const block = signal.subarray(b * TAP_BLOCK_SAMPLES, (b + 1) * TAP_BLOCK_SAMPLES);
    return Math.sqrt(block.reduce((total, x) => total + x * x, 0) / TAP_BLOCK_SAMPLES);
  });

const percentile = (values: readonly number[], fraction: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(fraction * (sorted.length - 1))] ?? 0;
};

const onsetBlocks = (levels: readonly number[]): readonly number[] => {
  const threshold = Math.max(
    TAP_MIN_LEVEL,
    TAP_NOISE_MARGIN * percentile(levels, TAP_NOISE_PERCENTILE),
  );
  return levels.reduce<readonly number[]>((found, level, b) => {
    const previous = Math.max(0, ...levels.slice(Math.max(0, b - TAP_RISE_BLOCKS), b));
    const last = found.at(-1);
    const isOnset =
      level >= threshold &&
      level >= TAP_RISE_RATIO * previous &&
      (last === undefined || b - last >= TAP_DEBOUNCE_BLOCKS);
    return isOnset ? [...found, b] : found;
  }, []);
};

const isClipped = (raw: readonly Samples[], onset: number) =>
  raw.some((channel) =>
    channel.subarray(onset, onset + CLIP_CHECK_SAMPLES).some((x) => Math.abs(x) >= CLIP_LEVEL),
  );

const isTooClose = (onsets: readonly number[], onset: number) =>
  onsets.some(
    (other) =>
      other !== onset &&
      other >= onset - TAP_WINDOW_LEAD_SAMPLES &&
      other < onset - TAP_WINDOW_LEAD_SAMPLES + TAP_WINDOW_SAMPLES,
  );

const rejectionOf = (
  onset: number,
  onsets: readonly number[],
  raw: readonly Samples[],
  length: number,
): TapRejection | null => {
  if (isClipped(raw, onset)) return "clipped";
  if (isTooClose(onsets, onset)) return "tooClose";
  if (onset + MIN_SAMPLES_AFTER_ONSET > length) return "cutOff";
  return null;
};

export const detectTaps = (input: {
  filtered: Samples;
  raw: readonly Samples[];
}): readonly Tap[] => {
  const onsets = onsetBlocks(blockLevels(input.filtered)).map((b) => b * TAP_BLOCK_SAMPLES);
  return onsets.slice(0, MAX_TAPS).map((onset, i) => ({
    number: i + 1,
    onset,
    rejection: rejectionOf(onset, onsets, input.raw, input.filtered.length),
  }));
};
