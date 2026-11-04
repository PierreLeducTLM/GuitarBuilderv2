export const seededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randomSignal = (length: number, seed: number): Float64Array => {
  const next = seededRandom(seed);
  return Float64Array.from({ length }, () => next() * 2 - 1);
};

export const sine = (options: {
  frequency: number;
  sampleRate: number;
  length: number;
  amplitude?: number;
}): Float64Array => {
  const { frequency, sampleRate, length, amplitude = 1 } = options;
  return Float64Array.from(
    { length },
    (_, n) => amplitude * Math.sin((2 * Math.PI * frequency * n) / sampleRate),
  );
};

export const gaussianNoise = (options: {
  length: number;
  rms: number;
  seed: number;
}): Float64Array => {
  const next = seededRandom(options.seed);
  return Float64Array.from({ length: options.length }, () => {
    const u = Math.max(next(), Number.EPSILON);
    const v = next();
    return options.rms * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  });
};

export type DecayingTone = {
  readonly onset: number;
  readonly amplitude: number;
  readonly tau: number;
  readonly frequency: number;
};

export const withTaps = (
  base: Float64Array,
  taps: readonly DecayingTone[],
  sampleRate = 48000,
): Float64Array =>
  base.map((x, n) =>
    taps.reduce((total, tap) => {
      if (n < tap.onset) return total;
      const t = (n - tap.onset) / sampleRate;
      return (
        total + tap.amplitude * Math.exp(-t / tap.tau) * Math.sin(2 * Math.PI * tap.frequency * t)
      );
    }, x),
  );
