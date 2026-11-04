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
