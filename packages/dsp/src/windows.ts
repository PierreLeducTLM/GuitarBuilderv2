export type Window = {
  readonly values: Float64Array;
  readonly sum: number;
};

const hannBySize = new Map<number, Window>();

export const hann = (size: number): Window => {
  const cached = hannBySize.get(size);
  if (cached) return cached;
  const values = Float64Array.from(
    { length: size },
    (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1)),
  );
  const window = { values, sum: values.reduce((total, w) => total + w, 0) };
  hannBySize.set(size, window);
  return window;
};
