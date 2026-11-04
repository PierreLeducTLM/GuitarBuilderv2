export type WaveformColumn = { readonly min: number; readonly max: number };

export const waveformColumns = (
  signal: Float64Array | Float32Array,
  columns: number,
): readonly WaveformColumn[] => {
  if (signal.length === 0) return [];
  return Array.from({ length: columns }, (_, c) => {
    const slice = signal.subarray(
      Math.floor((c * signal.length) / columns),
      Math.floor(((c + 1) * signal.length) / columns),
    );
    let min = 0;
    let max = 0;
    for (const x of slice) {
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    return { min, max };
  });
};
