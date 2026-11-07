import { describe, expect, it } from "vitest";
import { measureLevel, measureTone } from "./index.ts";
import { gaussianNoise, sine, withTaps } from "./test-support/signals.ts";

const sampleRate = 48000;

const checkRecording = (options: { tapAmplitude?: number; seconds?: number } = {}) => {
  const base = gaussianNoise({
    length: Math.round((options.seconds ?? 5) * sampleRate),
    rms: 0.0002,
    seed: 3,
  });
  return options.tapAmplitude === undefined
    ? base
    : withTaps(base, [
        { onset: 48000, amplitude: options.tapAmplitude, tau: 0.12, frequency: 190 },
      ]);
};

const level = (signal: Float64Array) => measureLevel({ raw: signal, filtered: signal });

const withSampleAt = (signal: Float64Array, index: number, value: number) =>
  signal.map((x, n) => (n === index ? value : x));

describe("check level", () => {
  it("reports the noise floor and peak of a good tap", () => {
    expect(level(checkRecording({ tapAmplitude: 0.5 }))).toEqual({
      verdict: "good",
      noiseFloorDb: expect.closeTo(-74.4, 0),
      peakDb: expect.closeTo(-6.11, 1),
    });
  });

  it("reports clipping when a sample reaches 0.999", () => {
    const signal = withSampleAt(checkRecording({ tapAmplitude: 0.4 }), 48010, 0.999);
    expect(level(signal)).toMatchObject({ verdict: "clipping" });
  });

  it("reports clipping on a negative full-scale sample", () => {
    const signal = withSampleAt(checkRecording({ tapAmplitude: 0.4 }), 48010, -1);
    expect(level(signal)).toMatchObject({ verdict: "clipping", peakDb: 0 });
  });

  it("does not report clipping just below 0.999", () => {
    const signal = withSampleAt(checkRecording({ tapAmplitude: 0.4 }), 48010, 0.9989);
    expect(level(signal)).toMatchObject({ verdict: "good" });
  });

  it("reports a low level below 0.05", () => {
    expect(level(checkRecording({ tapAmplitude: 0.03 }))).toMatchObject({ verdict: "low" });
  });

  it("finds a peak of exactly 0.05 good", () => {
    const signal = withSampleAt(checkRecording({ tapAmplitude: 0.03 }), 48010, 0.05);
    expect(level(signal)).toMatchObject({ verdict: "good" });
  });

  it("reports no tap in room noise", () => {
    expect(level(checkRecording())).toMatchObject({ verdict: "noTap" });
  });

  it("reports no tap, not clipping, for a steady full-scale tone", () => {
    expect(level(sine({ frequency: 440, sampleRate, length: 5 * sampleRate }))).toMatchObject({
      verdict: "noTap",
    });
  });

  it("measures the peak in the raw signal", () => {
    const raw = withSampleAt(checkRecording(), 100, 0.3);
    expect(measureLevel({ raw, filtered: checkRecording({ tapAmplitude: 0.5 }) })).toMatchObject({
      verdict: "good",
      peakDb: expect.closeTo(-10.46, 1),
    });
  });

  it("finds the taps in the filtered signal", () => {
    expect(
      measureLevel({ raw: checkRecording(), filtered: checkRecording({ tapAmplitude: 0.5 }) }),
    ).toMatchObject({ verdict: "low" });
  });

  it("floors the levels of digital silence at -200 dBFS", () => {
    expect(level(new Float64Array(5 * sampleRate))).toEqual({
      verdict: "noTap",
      noiseFloorDb: -200,
      peakDb: -200,
    });
  });
});

const tone = (frequency: number, amplitude = 0.5) =>
  sine({ frequency, sampleRate, length: 3 * sampleRate, amplitude });

const toneAt = (samples: Float64Array) => measureTone({ samples, sampleRate });

describe("test tone", () => {
  it("reads a 440.2 Hz tone and its deviation from 440 Hz", () => {
    expect(toneAt(tone(440.2))).toEqual({
      heard: true,
      frequency: expect.closeTo(440.2, 1),
      cents: expect.closeTo(0.79, 1),
    });
  });

  it("reads a tone recorded through an interface at the wrong rate", () => {
    expect(toneAt(tone(478.9))).toMatchObject({ heard: true, cents: expect.closeTo(146.7, 0) });
  });

  it("reads a tone below 440 Hz as a negative deviation", () => {
    expect(toneAt(tone(404.25))).toMatchObject({ heard: true, cents: expect.closeTo(-146.7, 0) });
  });

  it("does not hear a tone at -70 dB", () => {
    expect(toneAt(tone(440, 10 ** (-70 / 20)))).toEqual({ heard: false });
  });

  it("hears a tone just above -60 dB and not just below", () => {
    const onBin = 439.453125;
    expect(toneAt(tone(onBin, 10 ** (-59.9 / 20)))).toMatchObject({ heard: true });
    expect(toneAt(tone(onBin, 10 ** (-60.1 / 20)))).toEqual({ heard: false });
  });

  it("takes the strongest point between 220 Hz and 880 Hz", () => {
    const samples = tone(440, 0.1).map(
      (x, n) =>
        x +
        0.8 * Math.sin((2 * Math.PI * 150 * n) / sampleRate) +
        0.8 * Math.sin((2 * Math.PI * 950 * n) / sampleRate),
    );
    expect(toneAt(samples)).toMatchObject({ heard: true, frequency: expect.closeTo(440, 0) });
  });

  it("reads the tone at both ends of the band", () => {
    expect(toneAt(tone(221))).toMatchObject({ frequency: expect.closeTo(221, 0) });
    expect(toneAt(tone(879))).toMatchObject({ frequency: expect.closeTo(879, 0) });
  });

  it("ignores louder rumble below the band", () => {
    const samples = tone(440, 0.1).map(
      (x, n) => x + 0.8 * Math.sin((2 * Math.PI * 32.2265625 * n) / sampleRate),
    );
    expect(toneAt(samples)).toMatchObject({ heard: true, frequency: expect.closeTo(440, 0) });
  });

  it("measures the centre of the recording, not its start or end", () => {
    const other = (frequency: number, n: number) =>
      0.9 * Math.sin((2 * Math.PI * frequency * n) / sampleRate);
    const samples = tone(440).map((x, n) => {
      if (n < 1.2 * sampleRate) return other(600, n);
      if (n >= 1.8 * sampleRate) return other(700, n);
      return x;
    });
    expect(toneAt(samples)).toMatchObject({ frequency: expect.closeTo(440, 0) });
  });
});
