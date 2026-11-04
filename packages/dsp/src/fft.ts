export type ComplexSignal = {
  readonly re: Float64Array;
  readonly im: Float64Array;
};

type Tables = {
  readonly reversed: Uint32Array;
  readonly cos: Float64Array;
  readonly sin: Float64Array;
};

const tablesBySize = new Map<number, Tables>();

const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0;

const buildTables = (size: number): Tables => {
  const bits = Math.log2(size);
  const reversed = Uint32Array.from({ length: size }, (_, i) => {
    let r = 0;
    for (let b = 0; b < bits; b += 1) r = (r << 1) | ((i >> b) & 1);
    return r;
  });
  const half = size / 2;
  const cos = Float64Array.from({ length: half }, (_, k) => Math.cos((2 * Math.PI * k) / size));
  const sin = Float64Array.from({ length: half }, (_, k) => Math.sin((2 * Math.PI * k) / size));
  return { reversed, cos, sin };
};

const tablesFor = (size: number): Tables => {
  const cached = tablesBySize.get(size);
  if (cached) return cached;
  const tables = buildTables(size);
  tablesBySize.set(size, tables);
  return tables;
};

const transform = (input: ComplexSignal, direction: 1 | -1): ComplexSignal => {
  const size = input.re.length;
  if (input.im.length !== size)
    throw new Error("Real and imaginary parts must have the same length");
  if (!isPowerOfTwo(size)) throw new Error("FFT length must be a power of two");
  const { reversed, cos, sin } = tablesFor(size);
  const re = Float64Array.from(reversed, (j) => input.re[j] ?? 0);
  const im = Float64Array.from(reversed, (j) => input.im[j] ?? 0);
  for (let length = 2; length <= size; length *= 2) {
    const half = length / 2;
    const step = size / length;
    for (let start = 0; start < size; start += length) {
      for (let k = 0; k < half; k += 1) {
        const wRe = cos[k * step] ?? 1;
        const wIm = direction * (sin[k * step] ?? 0);
        const a = start + k;
        const b = a + half;
        const bRe = re[b] ?? 0;
        const bIm = im[b] ?? 0;
        const tRe = bRe * wRe - bIm * wIm;
        const tIm = bRe * wIm + bIm * wRe;
        const aRe = re[a] ?? 0;
        const aIm = im[a] ?? 0;
        re[a] = aRe + tRe;
        im[a] = aIm + tIm;
        re[b] = aRe - tRe;
        im[b] = aIm - tIm;
      }
    }
  }
  return { re, im };
};

export const fft = (input: ComplexSignal): ComplexSignal => transform(input, -1);

export const inverseFft = (input: ComplexSignal): ComplexSignal => {
  const size = input.re.length;
  const { re, im } = transform(input, 1);
  return { re: re.map((x) => x / size), im: im.map((x) => x / size) };
};

export const realSpectrum = (frame: Float64Array): ComplexSignal => {
  const { re, im } = fft({ re: frame, im: new Float64Array(frame.length) });
  const half = frame.length / 2;
  return { re: re.slice(0, half), im: im.slice(0, half) };
};
