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

export const pointsFromDb = (
  levels: readonly number[],
  options: { firstBin: number; binWidth: number },
) =>
  levels.map((db, i) => ({
    frequency: (options.firstBin + i) * options.binWidth,
    magnitude: 10 ** (db / 20),
    db,
  }));

export const spikes = (options: {
  count: number;
  floor: number;
  at: Readonly<Record<number, number>>;
}): readonly number[] =>
  Array.from({ length: options.count }, (_, i) => options.at[i] ?? options.floor);

export type Mode = {
  readonly frequency: number;
  readonly amplitude: number;
  readonly tau: number;
};

export const ringing = (modes: readonly Mode[], length: number, sampleRate = 48000) =>
  Float64Array.from({ length }, (_, n) => {
    const t = n / sampleRate;
    return modes.reduce(
      (total, mode) =>
        total +
        mode.amplitude * Math.exp(-t / mode.tau) * Math.sin(2 * Math.PI * mode.frequency * t),
      0,
    );
  });

export type RingingTap = {
  readonly modes: readonly Mode[];
  readonly seconds: number;
};

const NEXT_TAP_GAP = 480;

export const tapRecording = (options: {
  quietSeconds: number;
  taps: readonly RingingTap[];
  sigma: number;
  seed: number;
}): { readonly signal: Float64Array; readonly onsets: readonly number[] } => {
  const sampleRate = 48000;
  const lead =
    options.quietSeconds > 0 ? Math.round(options.quietSeconds * sampleRate) + NEXT_TAP_GAP : 0;
  const lengths = options.taps.map(
    (tap, i) =>
      Math.round(tap.seconds * sampleRate) + (i < options.taps.length - 1 ? NEXT_TAP_GAP : 0),
  );
  const onsets = lengths.map((_, i) => lead + lengths.slice(0, i).reduce((a, b) => a + b, 0));
  const total = lead + lengths.reduce((a, b) => a + b, 0);
  const signal = gaussianNoise({ length: total, rms: options.sigma, seed: options.seed });
  options.taps.forEach((tap, i) => {
    const onset = onsets[i] ?? 0;
    ringing(tap.modes, lengths[i] ?? 0).forEach((x, n) => {
      signal[onset + n] = (signal[onset + n] ?? 0) + x;
    });
  });
  return { signal, onsets };
};
