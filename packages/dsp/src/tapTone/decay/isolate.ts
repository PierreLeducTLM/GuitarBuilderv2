import { DECAY_DECIMATION, DECAY_SMOOTHER_STAGES, SAMPLE_RATE } from "../constants.ts";

export type Samples = Float64Array | Float32Array;

export type IsolatedResonance = {
  readonly firstIndex: number;
  readonly times: Float64Array;
  readonly envelope: Float64Array;
  readonly response: Float64Array;
};

type Complex = {
  readonly re: Float64Array;
  readonly im: Float64Array;
};

const convolve = (a: readonly number[], b: readonly number[]): readonly number[] =>
  Array.from({ length: a.length + b.length - 1 }, (_, n) =>
    a.reduce((total, x, i) => total + x * (b[n - i] ?? 0), 0),
  );

const box: readonly number[] = Array.from({ length: DECAY_DECIMATION }, () => 1 / DECAY_DECIMATION);

const smoother = Float64Array.from(
  Array.from({ length: DECAY_SMOOTHER_STAGES - 1 }).reduce<readonly number[]>(
    (kernel) => convolve(kernel, box),
    box,
  ),
);

const blackmanByLength = new Map<number, Float64Array>();

const blackman = (length: number): Float64Array => {
  const cached = blackmanByLength.get(length);
  if (cached) return cached;
  const raw = Float64Array.from({ length }, (_, m) => {
    const phase = (2 * Math.PI * m) / (length - 1);
    return 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
  });
  const sum = raw.reduce((total, w) => total + w, 0);
  const kernel = raw.map((w) => w / sum);
  blackmanByLength.set(length, kernel);
  return kernel;
};

export const sampleTime = (k: number) =>
  (DECAY_DECIMATION * k + (smoother.length - 1) / 2) / SAMPLE_RATE;

const demodulate = (samples: Samples, frequency: number): Complex => {
  const step = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const re = new Float64Array(samples.length);
  const im = new Float64Array(samples.length);
  for (let n = 0; n < samples.length; n += 1) {
    const x = samples[n] ?? 0;
    re[n] = x * Math.cos(step * n);
    im[n] = -x * Math.sin(step * n);
  }
  return { re, im };
};

const smoothAndDecimate = (signal: Complex): Complex => {
  const count = Math.max(
    0,
    Math.floor((signal.re.length - smoother.length) / DECAY_DECIMATION) + 1,
  );
  const re = new Float64Array(count);
  const im = new Float64Array(count);
  for (let k = 0; k < count; k += 1) {
    const offset = k * DECAY_DECIMATION;
    let sumRe = 0;
    let sumIm = 0;
    for (let m = 0; m < smoother.length; m += 1) {
      const c = smoother[m] ?? 0;
      sumRe += c * (signal.re[offset + m] ?? 0);
      sumIm += c * (signal.im[offset + m] ?? 0);
    }
    re[k] = sumRe;
    im[k] = sumIm;
  }
  return { re, im };
};

export const isolateResonance = (input: {
  samples: Samples;
  frequency: number;
  halfLength: number;
}): IsolatedResonance => {
  const { halfLength, frequency } = input;
  const decimated = smoothAndDecimate(demodulate(input.samples, frequency));
  const kernel = blackman(2 * halfLength + 1);
  const count = Math.max(0, decimated.re.length - 2 * halfLength);
  const times = new Float64Array(count);
  const envelope = new Float64Array(count);
  const response = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    let yRe = 0;
    let yIm = 0;
    for (let m = 0; m < kernel.length; m += 1) {
      const w = kernel[m] ?? 0;
      yRe += w * (decimated.re[i + m] ?? 0);
      yIm += w * (decimated.im[i + m] ?? 0);
    }
    const t = sampleTime(i + halfLength);
    const phase = 2 * Math.PI * frequency * t;
    times[i] = t;
    envelope[i] = 2 * Math.hypot(yRe, yIm);
    response[i] = 2 * (yRe * Math.cos(phase) - yIm * Math.sin(phase));
  }
  return { firstIndex: halfLength, times, envelope, response };
};
