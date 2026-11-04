export type BiquadCoefficients = {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
};

export const biquadHighPass = (options: {
  sampleRate: number;
  cutoff: number;
  q: number;
}): BiquadCoefficients => {
  const omega = (2 * Math.PI * options.cutoff) / options.sampleRate;
  const alpha = Math.sin(omega) / (2 * options.q);
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
};

export const applyBiquad = (
  signal: Float64Array | Float32Array,
  { b0, b1, b2, a1, a2 }: BiquadCoefficients,
): Float64Array => {
  const output = new Float64Array(signal.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  signal.forEach((x, n) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[n] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  });
  return output;
};
