export const resample = (input: {
  samples: Float32Array;
  fromRate: number;
  toRate: number;
}): Float32Array => {
  const { samples, fromRate, toRate } = input;
  const step = fromRate / toRate;
  return Float32Array.from({ length: Math.round((samples.length * toRate) / fromRate) }, (_, n) => {
    const position = n * step;
    const index = Math.floor(position);
    const before = samples[index] ?? 0;
    const after = samples[index + 1] ?? before;
    return before + (after - before) * (position - index);
  });
};
