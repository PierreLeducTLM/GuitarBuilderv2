import { describe, expect, it } from "vitest";
import { type DecayPeak, isolateResonance, measureDecayQ, tapSegment } from "./index.ts";
import { type Mode, randomSignal, sine, tapRecording } from "./test-support/signals.ts";

const sampleRate = 48000;

const listed = (frequency: number, level = -20) => ({ frequency, level });

const peakAt = (frequency: number, overrides: Partial<DecayPeak> = {}): DecayPeak => ({
  frequency,
  level: -20,
  bandwidth: null,
  ...overrides,
});

const isolationOf = (peak: DecayPeak, others: readonly { frequency: number; level: number }[]) =>
  measureDecayQ({ signal: new Float64Array(0), onsets: [], used: [], peak, others });

const analysed = (result: { reason: string | null }) => result.reason !== "MODE_NOT_ISOLATED";

const singleTap = (modes: readonly Mode[], options: { sigma: number; seconds?: number }) =>
  tapRecording({
    quietSeconds: 0,
    taps: [{ modes, seconds: options.seconds ?? 1.5 }],
    sigma: options.sigma,
    seed: 7,
  }).signal;

const isolate = (
  signal: Float64Array | Float32Array,
  peak: DecayPeak,
  others: readonly { frequency: number; level: number }[],
) => {
  const { isolation } = isolationOf(peak, others);
  return isolateResonance({
    samples: signal,
    frequency: peak.frequency,
    halfLength: isolation.halfLength,
  });
};

const envelopeQ = (
  isolated: ReturnType<typeof isolateResonance>,
  options: { frequency: number; overSeconds: number },
) => {
  const from = 5;
  const to = from + Math.round(options.overSeconds * 1000);
  const tau =
    ((isolated.times[to] ?? 0) - (isolated.times[from] ?? 0)) /
    Math.log((isolated.envelope[from] ?? 0) / (isolated.envelope[to] ?? 1));
  return Math.PI * options.frequency * tau;
};

const runningMean = (values: readonly number[], width: number) =>
  values
    .slice(width - 1)
    .map((_, n) => values.slice(n, n + width).reduce((a, b) => a + b, 0) / width);

const referenceChain = (audio: Float64Array, frequency: number, halfLength: number) => {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const smooth = (values: readonly number[]) =>
    [1, 2, 3, 4].reduce((stage) => runningMean(stage, 48), values).filter((_, n) => n % 48 === 0);
  const re = smooth([...audio].map((x, n) => x * Math.cos(omega * n)));
  const im = smooth([...audio].map((x, n) => -x * Math.sin(omega * n)));
  const length = 2 * halfLength + 1;
  const raw = Array.from(
    { length },
    (_, m) =>
      0.42 -
      0.5 * Math.cos((2 * Math.PI * m) / (length - 1)) +
      0.08 * Math.cos((4 * Math.PI * m) / (length - 1)),
  );
  const total = raw.reduce((a, b) => a + b, 0);
  const kernel = raw.map((w) => w / total);
  const valid = Array.from({ length: Math.max(0, re.length - 2 * halfLength) }, (_, i) => {
    const k = i + halfLength;
    const yRe = kernel.reduce((sum, w, m) => sum + w * (re[k - halfLength + m] ?? 0), 0);
    const yIm = kernel.reduce((sum, w, m) => sum + w * (im[k - halfLength + m] ?? 0), 0);
    const t = (48 * k + 94) / sampleRate;
    const phase = 2 * Math.PI * frequency * t;
    return {
      t,
      e: 2 * Math.sqrt(yRe * yRe + yIm * yIm),
      r: 2 * (yRe * Math.cos(phase) - yIm * Math.sin(phase)),
    };
  });
  return {
    times: valid.map((v) => v.t),
    envelope: valid.map((v) => v.e),
    response: valid.map((v) => v.r),
  };
};

const withinPercent = (actual: number, expected: number, percent: number) =>
  expect(Math.abs(actual / expected - 1) * 100).toBeLessThanOrEqual(percent);

describe("decay Q tap segment", () => {
  it("ends 10 ms before the next detected onset (71520 samples for onsets 48000 and 120000)", () => {
    const segment = tapSegment({ onset: 48000, onsets: [48000, 120000], length: 480000 });
    expect(segment).toEqual({ start: 48000, end: 119520 });
    expect(segment.end - segment.start).toBe(71520);
  });

  it("ignores onsets before the tap when looking for the next one", () => {
    expect(tapSegment({ onset: 48000, onsets: [10000, 48000, 120000], length: 480000 })).toEqual({
      start: 48000,
      end: 119520,
    });
  });

  it("ends with the recording", () => {
    expect(tapSegment({ onset: 48000, onsets: [48000], length: 100000 })).toEqual({
      start: 48000,
      end: 100000,
    });
  });

  it("lasts at most 3 s", () => {
    expect(tapSegment({ onset: 48000, onsets: [48000, 300000], length: 480000 })).toEqual({
      start: 48000,
      end: 192000,
    });
  });
});

describe("decay Q isolation band", () => {
  it("uses the 2 f0 image when no neighbour is relevant, with the 0.02 s minimum kernel", () => {
    const result = isolationOf(peakAt(180), []);
    expect(analysed(result)).toBe(true);
    expect(result.isolation).toEqual({
      neighbour: null,
      spacing: 360,
      kernelSeconds: 0.02,
      kernelLength: 21,
      halfLength: 10,
      precheckDb: null,
    });
  });

  it("sizes the kernel from the image for a low peak (40 Hz: 0.04375 s, 45 taps)", () => {
    const { isolation } = isolationOf(peakAt(40), []);
    expect(isolation.spacing).toBe(80);
    expect(isolation.kernelSeconds).toBeCloseTo(0.04375, 12);
    expect(isolation.kernelLength).toBe(45);
  });

  it("sizes the kernel from a relevant neighbour 12 Hz away (0.2917 s, 293 taps)", () => {
    const result = isolationOf(peakAt(180), [listed(192)]);
    const { isolation } = result;
    expect(analysed(result)).toBe(true);
    expect(isolation.neighbour).toBe(192);
    expect(isolation.spacing).toBe(12);
    expect(isolation.kernelSeconds).toBeCloseTo(0.2917, 4);
    expect(isolation.kernelLength).toBe(293);
    expect(isolation.halfLength).toBe(146);
  });

  it("takes the nearest relevant neighbour on either side", () => {
    const { isolation } = isolationOf(peakAt(250), [listed(300), listed(150), listed(235)]);
    expect(isolation.neighbour).toBe(235);
    expect(isolation.spacing).toBe(15);
    expect(isolationOf(peakAt(250), [listed(300), listed(150)]).isolation.kernelSeconds).toBe(0.07);
  });

  it("names the first listed of two equally close neighbours", () => {
    expect(isolationOf(peakAt(180), [listed(170), listed(190)]).isolation.neighbour).toBe(170);
    expect(isolationOf(peakAt(180), [listed(190), listed(170)]).isolation.neighbour).toBe(190);
  });

  it("keeps the image when every neighbour is further away than 2 f0", () => {
    expect(isolationOf(peakAt(40), [listed(130)]).isolation).toMatchObject({
      neighbour: null,
      spacing: 80,
    });
    expect(isolationOf(peakAt(40), [listed(110)]).isolation).toMatchObject({
      neighbour: 110,
      spacing: 70,
    });
    expect(isolationOf(peakAt(40), [listed(120)]).isolation).toMatchObject({
      neighbour: 120,
      spacing: 80,
    });
  });

  it("counts neighbours down to 30 dB below the peak and ignores the peak itself", () => {
    const peak = peakAt(180, { level: -20 });
    expect(isolationOf(peak, [listed(192, -50)]).isolation.neighbour).toBe(192);
    expect(isolationOf(peak, [listed(192, -50.01)]).isolation.neighbour).toBeNull();
    expect(isolationOf(peak, [listed(180, -10)]).isolation.neighbour).toBeNull();
  });

  it("refuses a peak with a relevant neighbour 5 Hz away as not isolated", () => {
    expect(isolationOf(peakAt(200), [listed(205)])).toMatchObject({
      reason: "MODE_NOT_ISOLATED",
      isolation: { neighbour: 205, spacing: 5 },
    });
  });

  it("analyses a peak 7.0 Hz from its neighbour but not 6.9 Hz", () => {
    const sevenApart = isolationOf(peakAt(200), [listed(207)]);
    expect(analysed(sevenApart)).toBe(true);
    expect(sevenApart.isolation).toMatchObject({ kernelSeconds: 0.5, kernelLength: 501 });
    expect(isolationOf(peakAt(200), [listed(206.9)]).reason).toBe("MODE_NOT_ISOLATED");
  });

  it("refuses a broad peak whose decay before the fit start exceeds 30 dB", () => {
    const broad = isolationOf(peakAt(180, { bandwidth: 20 }), [listed(190)]);
    expect(broad.reason).toBe("MODE_NOT_ISOLATED");
    expect(broad.isolation.precheckDb).toBeCloseTo(27.29 * 20 * (0.005 + 0.35 / 2 + 0.00196), 9);
    expect(broad.isolation.precheckDb).toBeCloseTo(99.3, 1);
    const narrow = isolationOf(peakAt(180, { bandwidth: 2 }), [listed(190)]);
    expect(analysed(narrow)).toBe(true);
    expect(narrow.isolation.precheckDb).toBeCloseTo(9.93, 2);
  });

  it("allows a pre-check of exactly 30 dB", () => {
    const limit = 30 / (27.29 * (0.005 + 0.35 / 2 + 0.00196));
    expect(analysed(isolationOf(peakAt(180, { bandwidth: limit }), [listed(190)]))).toBe(true);
    expect(isolationOf(peakAt(180, { bandwidth: limit * 1.001 }), [listed(190)]).reason).toBe(
      "MODE_NOT_ISOLATED",
    );
  });
});

describe("decay Q isolation chain", () => {
  it("keeps only the samples whose whole filter support lies in the segment, at 1000 Hz", () => {
    const isolated = isolate(singleTap([], { sigma: 0 }), peakAt(180), []);
    expect(isolated.envelope).toHaveLength(1477);
    expect(isolated.times).toHaveLength(1477);
    expect(isolated.firstIndex).toBe(10);
    expect(isolated.times[0]).toBeCloseTo((48 * 10 + 94) / sampleRate, 12);
    expect(isolated.times[1476]).toBeCloseTo((48 * 1486 + 94) / sampleRate, 12);
  });

  it("gives nothing for a segment shorter than the filter support", () => {
    const support = 189 + 48 * 20;
    expect(isolate(new Float64Array(support), peakAt(180), []).envelope).toHaveLength(1);
    expect(isolate(new Float64Array(support - 1), peakAt(180), []).envelope).toHaveLength(0);
    expect(isolate(new Float64Array(100), peakAt(180), []).envelope).toHaveLength(0);
  });

  it("reads a steady tone's amplitude as its envelope and redraws the tone itself", () => {
    const tone = sine({ frequency: 180, sampleRate, length: sampleRate, amplitude: 0.3 });
    const isolated = isolate(tone, peakAt(180), []);
    for (const value of isolated.envelope) expect(Math.abs(value - 0.3)).toBeLessThan(3e-4);
    isolated.times.forEach((t, k) => {
      expect(
        Math.abs((isolated.response[k] ?? 0) - 0.3 * Math.sin(2 * Math.PI * 180 * t)),
      ).toBeLessThan(3e-4);
    });
  });

  it.each([
    [180, 10],
    [97.3, 37],
  ])(
    "matches the spec's chain step by step at %f Hz with half-length %i",
    (frequency, halfLength) => {
      const audio = randomSignal(14400, 3);
      const isolated = isolateResonance({ samples: audio, frequency, halfLength });
      const expected = referenceChain(audio, frequency, halfLength);
      expect(isolated.firstIndex).toBe(halfLength);
      expect(isolated.envelope).toHaveLength(expected.envelope.length);
      expected.envelope.forEach((value, i) => {
        expect(isolated.envelope[i]).toBeCloseTo(value, 12);
        expect(isolated.response[i]).toBeCloseTo(expected.response[i] ?? 0, 12);
        expect(isolated.times[i]).toBeCloseTo(expected.times[i] ?? 0, 12);
      });
    },
  );

  it("suppresses a tone at the neighbour spacing by more than 50 dB", () => {
    const neighbourTone = sine({ frequency: 192, sampleRate, length: sampleRate });
    const isolated = isolate(neighbourTone, peakAt(180), [listed(192)]);
    expect(Math.max(...isolated.envelope)).toBeLessThan(10 ** (-50 / 20));
  });

  it("accepts single-precision audio", () => {
    const tone = Float32Array.from(
      sine({ frequency: 180, sampleRate, length: sampleRate, amplitude: 0.3 }),
    );
    const isolated = isolate(tone, peakAt(180), []);
    expect(isolated.envelope[100]).toBeCloseTo(0.3, 3);
  });

  it.each([
    [35, 0.1],
    [12, 0.2917],
    [7, 0.5],
  ])(
    "adds no settling bias with a neighbour %i Hz away (kernel %f s)",
    (spacing, kernelSeconds) => {
      const others = [listed(180 + spacing)];
      expect(isolationOf(peakAt(180), others).isolation.kernelSeconds).toBeCloseTo(
        kernelSeconds,
        4,
      );
      const signal = singleTap([{ frequency: 180, amplitude: 0.5, tau: 0.2 }], { sigma: 0 });
      const q = envelopeQ(isolate(signal, peakAt(180), others), {
        frequency: 180,
        overSeconds: 0.6,
      });
      withinPercent(q, 113.1, 0.1);
    },
  );

  it("separates two modes 7 Hz apart (200 and 207 Hz, Q 188.5)", () => {
    const signal = singleTap(
      [
        { frequency: 200, amplitude: 0.5, tau: 0.3 },
        { frequency: 207, amplitude: 0.5, tau: 0.3 },
      ],
      { sigma: 1e-4 },
    );
    const q = envelopeQ(isolate(signal, peakAt(200), [listed(207)]), {
      frequency: 200,
      overSeconds: 0.6,
    });
    withinPercent(q, 188.5, 1);
  });

  it("measures a 40 Hz mode through its image-sized kernel (Q 12.57)", () => {
    const signal = singleTap([{ frequency: 40, amplitude: 0.5, tau: 0.1 }], { sigma: 1e-4 });
    const q = envelopeQ(isolate(signal, peakAt(40), []), { frequency: 40, overSeconds: 0.2 });
    withinPercent(q, 12.57, 1);
  });

  it("rejects a strong 820 Hz mode that aliases onto 180 Hz after decimation", () => {
    const signal = singleTap(
      [
        { frequency: 180, amplitude: 0.05, tau: 0.2 },
        { frequency: 820, amplitude: 0.5, tau: 0.4 },
      ],
      { sigma: 1e-5 },
    );
    const q = envelopeQ(isolate(signal, peakAt(180), [listed(820)]), {
      frequency: 180,
      overSeconds: 0.4,
    });
    withinPercent(q, 113.1, 1);
  });
});
