/**
 * Signal processing for Guitar Builder. Populated by the tap-tone and
 * acoustic-analysis changes; this package must stay free of DOM APIs.
 */
export const DSP_PACKAGE_NAME = "@gb/dsp";
export { applyBiquad, type BiquadCoefficients, biquadHighPass } from "./biquad.ts";
export { type CheckLevel, type LevelVerdict, measureLevel } from "./capture/level.ts";
export { type CaptureTiming, judgeRate, type RateVerdict } from "./capture/rate.ts";
export { resample } from "./capture/resample.ts";
export { measureTone, TEST_TONE_HZ, type ToneReading } from "./capture/tone.ts";
export { type ComplexSignal, fft, inverseFft, realSpectrum } from "./fft.ts";
export { type SpectralQ, spectralQ } from "./tapTone/bandwidthQ.ts";
export {
  type BodyResonance,
  type BodyResonances,
  identifyBodyResonances,
  reattachRole,
} from "./tapTone/body.ts";
export { CLIP_LEVEL } from "./tapTone/constants.ts";
export type { DecayIsolation, DecayPeak, NeighbourPeak } from "./tapTone/decay/band.ts";
export type { CombinedReason } from "./tapTone/decay/combine.ts";
export type {
  DecayInterval,
  DecayLine,
  FitEnd,
  TapDecayReason,
  TapFit,
} from "./tapTone/decay/fit.ts";
export {
  type DecayMarkers,
  type DecaySeries,
  inspectDecay,
  type SeriesPoint,
} from "./tapTone/decay/inspect.ts";
export {
  type IsolatedResonance,
  isolateResonance,
  type Samples,
} from "./tapTone/decay/isolate.ts";
export {
  type DecayInput,
  measureDecayQ,
  type PeakDecay,
  type PeakDecayReason,
  type TapDecay,
} from "./tapTone/decay/measure.ts";
export type { DecayNoise, NoiseSource } from "./tapTone/decay/noise.ts";
export { quietStretches, type SampleRange, tapSegment } from "./tapTone/decay/segment.ts";
export { noteLabel } from "./tapTone/note.ts";
export { detectPeaks, nearestPeak, type Peak } from "./tapTone/peaks.ts";
export { pointsFromRecord, recordFromPoints, type TapToneRecord } from "./tapTone/record.ts";
export {
  averageSpectrum,
  type SpectrumPoint,
  spectrumPoints,
  tapPower,
} from "./tapTone/spectrum.ts";
export {
  analyzeTake,
  type DecayTarget,
  recomputeTake,
  resultFromRecord,
  runTake,
  type TakeAnalysis,
  type TakeCache,
  type TakeInput,
  type TakeMode,
  type TakePeak,
  type TakeResult,
  takeDecayQ,
  takeDecaySeries,
} from "./tapTone/take.ts";
export { detectTaps, type Tap, type TapRejection } from "./tapTone/taps.ts";
export { encodeWav, wavFileName } from "./wav.ts";
export { hann, type Window } from "./windows.ts";
export { type WoodInputs, type WoodProperties, woodProperties } from "./wood/properties.ts";
