/**
 * Signal processing for Guitar Builder. Populated by the tap-tone and
 * acoustic-analysis changes; this package must stay free of DOM APIs.
 */
export const DSP_PACKAGE_NAME = "@gb/dsp";
export { applyBiquad, type BiquadCoefficients, biquadHighPass } from "./biquad.ts";
export { type ComplexSignal, fft, inverseFft, realSpectrum } from "./fft.ts";
export { type SpectralQ, spectralQ } from "./tapTone/bandwidthQ.ts";
export {
  type BodyResonance,
  type BodyResonances,
  identifyBodyResonances,
  reattachRole,
} from "./tapTone/body.ts";
export type { DecayIsolation, DecayPeak, NeighbourPeak } from "./tapTone/decay/band.ts";
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
} from "./tapTone/decay/measure.ts";
export { type SampleRange, tapSegment } from "./tapTone/decay/segment.ts";
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
  recomputeTake,
  resultFromRecord,
  runTake,
  type TakeAnalysis,
  type TakeCache,
  type TakeInput,
  type TakeMode,
  type TakePeak,
  type TakeResult,
} from "./tapTone/take.ts";
export { detectTaps, type Tap, type TapRejection } from "./tapTone/taps.ts";
export { encodeWav, wavFileName } from "./wav.ts";
export { hann, type Window } from "./windows.ts";
