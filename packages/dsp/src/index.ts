/**
 * Signal processing for Guitar Builder. Populated by the tap-tone and
 * acoustic-analysis changes; this package must stay free of DOM APIs.
 */
export const DSP_PACKAGE_NAME = "@gb/dsp";
export { applyBiquad, type BiquadCoefficients, biquadHighPass } from "./biquad.ts";
export { type ComplexSignal, fft, inverseFft, realSpectrum } from "./fft.ts";
export { detectTaps, type Tap, type TapRejection } from "./tapTone/taps.ts";
export { hann, type Window } from "./windows.ts";
