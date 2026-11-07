const STANDARD_RATES = [8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000];
const ACCURATE_TOLERANCE = 0.03;
const SNAP_TOLERANCE = 0.01;
const MAX_DROPPED_FRACTION = 0.01;

export type CaptureTiming = {
  readonly elapsedSeconds: number;
  readonly statedRate: number;
  readonly decodedSeconds: number;
  readonly frames: { readonly delivered: number; readonly dropped: number };
};

export type RateVerdict =
  | { readonly verdict: "accurate"; readonly measuredRate: number; readonly cents: number }
  | {
      readonly verdict: "corrected";
      readonly trueRate: number;
      readonly measuredRate: number;
      readonly cents: number;
    }
  | {
      readonly verdict: "mismatch";
      readonly reason: "rate" | "dropped";
      readonly measuredRate: number;
      readonly cents: number;
    };

const nearestStandardRate = (rate: number): number =>
  STANDARD_RATES.reduce((best, candidate) =>
    Math.abs(candidate - rate) < Math.abs(best - rate) ? candidate : best,
  );

export const judgeRate = (capture: CaptureTiming): RateVerdict => {
  const { delivered, dropped } = capture.frames;
  const measuredRate = delivered / capture.elapsedSeconds;
  const cents = 1200 * Math.log2(capture.statedRate / measuredRate);
  if (dropped / (delivered + dropped) > MAX_DROPPED_FRACTION) {
    return { verdict: "mismatch", reason: "dropped", measuredRate, cents };
  }
  if (Math.abs(measuredRate - capture.statedRate) <= ACCURATE_TOLERANCE * capture.statedRate) {
    return { verdict: "accurate", measuredRate, cents };
  }
  const trueRate = nearestStandardRate(measuredRate);
  if (Math.abs(measuredRate - trueRate) <= SNAP_TOLERANCE * trueRate) {
    return { verdict: "corrected", trueRate, measuredRate, cents };
  }
  return { verdict: "mismatch", reason: "rate", measuredRate, cents };
};
