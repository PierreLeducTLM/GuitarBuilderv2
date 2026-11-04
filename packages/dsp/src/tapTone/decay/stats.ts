export const median = (values: Iterable<number>): number => {
  const sorted = Float64Array.from(values).sort();
  const middle = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[middle] ?? Number.NaN;
  return ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
};
