import { describe, expect, it } from "vitest";
import {
  averageSpectrum,
  encodeWav,
  noteLabel,
  pointsFromRecord,
  recordFromPoints,
  spectrumPoints,
  tapPower,
  wavFileName,
} from "./index.ts";
import { sine } from "./test-support/signals.ts";

describe("note label", () => {
  it.each([
    [181.82373046875, "F#3 -30 c"],
    [181.640625, "F#3 -32 c"],
    [440, "A4 +0 c"],
    [440 * 2 ** (-0.2 / 1200), "A4 +0 c"],
    [445, "A4 +20 c"],
    [261.6255653005986, "C4 +0 c"],
    [246.94165062806206, "B3 +0 c"],
    [32.70319566257483, "C1 +0 c"],
    [466.1637615180899, "Bb4 +0 c"],
    [311.1269837220809, "Eb4 +0 c"],
    [415.3046975799451, "Ab4 +0 c"],
    [880 * 2 ** (40 / 1200), "A5 +40 c"],
    [440 * 2 ** (-49 / 1200), "A4 -49 c"],
  ])("labels %f Hz as %s", (frequency, label) => {
    expect(noteLabel(frequency)).toBe(label);
  });
});

describe("spectrum record", () => {
  const points = spectrumPoints(
    averageSpectrum([tapPower(sine({ frequency: 375, sampleRate: 48000, length: 96000 }), 48000)]),
    48000,
  );

  it("holds the 662 points of a 48 kHz take with its sample rate, FFT size and bin width", () => {
    const record = recordFromPoints(points, { sampleRate: 48000, fftSize: 32768 });
    expect(record.frequencies).toHaveLength(662);
    expect(record.magnitudes).toHaveLength(662);
    expect(record.magnitudesDb).toHaveLength(662);
    expect(record.frequencies[0]).toBe(30.76171875);
    expect(record).toMatchObject({ sampleRate: 48000, fftSize: 32768, binWidth: 1.46484375 });
  });

  it("gives back the same points", () => {
    const record = recordFromPoints(points, { sampleRate: 48000, fftSize: 32768 });
    expect(pointsFromRecord(record)).toEqual(points);
  });

  it("reads an older 331-point record", () => {
    const legacy = {
      frequencies: Array.from({ length: 331 }, (_, i) => (11 + i) * 2.9296875),
      magnitudes: Array.from({ length: 331 }, () => 0.01),
      magnitudesDb: Array.from({ length: 331 }, () => -40),
      sampleRate: 48000,
      fftSize: 16384,
      binWidth: 2.9296875,
    };
    const restored = pointsFromRecord(legacy);
    expect(restored).toHaveLength(331);
    expect(restored[0]).toEqual({ frequency: 32.2265625, magnitude: 0.01, db: -40 });
  });
});

describe("WAV export", () => {
  const view = (bytes: Uint8Array) =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (bytes: Uint8Array, from: number) =>
    String.fromCharCode(...bytes.subarray(from, from + 4));

  it("writes a 44-byte 16-bit PCM header for 96,000 mono samples at 48 kHz", () => {
    const bytes = encodeWav([new Float32Array(96000)], 48000);
    const header = view(bytes);
    expect(bytes).toHaveLength(44 + 192000);
    expect(text(bytes, 0)).toBe("RIFF");
    expect(header.getUint32(4, true)).toBe(36 + 192000);
    expect(text(bytes, 8)).toBe("WAVE");
    expect(text(bytes, 12)).toBe("fmt ");
    expect(header.getUint32(16, true)).toBe(16);
    expect(header.getUint16(20, true)).toBe(1);
    expect(header.getUint16(22, true)).toBe(1);
    expect(header.getUint32(24, true)).toBe(48000);
    expect(header.getUint32(28, true)).toBe(96000);
    expect(header.getUint16(32, true)).toBe(2);
    expect(header.getUint16(34, true)).toBe(16);
    expect(text(bytes, 36)).toBe("data");
    expect(header.getUint32(40, true)).toBe(192000);
  });

  it("scales negative samples by 32768 and positive ones by 32767, clamped and truncated", () => {
    const bytes = encodeWav([Float32Array.of(-0.25, 0.5, 1.5, -1.5, 0.99999, -0.00002)], 48000);
    const samples = Array.from({ length: 6 }, (_, i) => view(bytes).getInt16(44 + 2 * i, true));
    expect(samples).toEqual([-8192, 16383, 32767, -32768, 32766, 0]);
  });

  it("interleaves channels and describes them in the header", () => {
    const bytes = encodeWav([Float32Array.of(0.5, 0.25), Float32Array.of(-0.5, -0.25)], 44100);
    const header = view(bytes);
    expect(header.getUint16(22, true)).toBe(2);
    expect(header.getUint32(28, true)).toBe(44100 * 4);
    expect(header.getUint16(32, true)).toBe(4);
    expect(header.getUint32(40, true)).toBe(8);
    expect(Array.from({ length: 4 }, (_, i) => header.getInt16(44 + 2 * i, true))).toEqual([
      16383, -16384, 8191, -8192,
    ]);
  });

  it("names the file after the UTC time without its fraction", () => {
    expect(wavFileName(new Date("2026-03-14T15:09:26.789Z"))).toBe(
      "wood-frequency-analysis-2026-03-14T15-09-26.wav",
    );
  });
});
