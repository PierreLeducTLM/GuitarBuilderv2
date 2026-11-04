import { readFileSync } from "node:fs";
import { runTake, type TakeMode, takeDecayQ } from "@gb/dsp";
import { describe, expect, it } from "vitest";
import { prepareAudio } from "@/components/tap-tone/audio";

const readWav = (name: string) => {
  const bytes = readFileSync(new URL(`../../../e2e/fixtures/${name}`, import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const samples = Float32Array.from(
    { length: (bytes.length - 44) / 2 },
    (_, i) => view.getInt16(44 + 2 * i, true) / 32768,
  );
  return prepareAudio({ channels: [samples], sampleRate: view.getUint32(24, true) });
};

const analyse = (name: string, mode: TakeMode) => {
  const audio = readWav(name);
  const signal = audio.filtered[0] ?? new Float64Array(0);
  return runTake({
    filtered: signal,
    raw: audio.raw,
    sampleRate: audio.sampleRate,
    mode,
    mobile: false,
  });
};

describe("end-to-end fixtures", () => {
  it("taps.wav: three plate taps with 190 and 95 Hz modes", () => {
    const { cache, result } = analyse("taps.wav", "plate");
    expect(result.taps.map((t) => [t.onset / 48000, t.rejection])).toEqual([
      [0.5, null],
      [1.6, null],
      [2.75, null],
    ]);
    expect(result.peaks.map((p) => Math.round(p.frequency))).toEqual([190, 95]);
    const top = result.peaks[0];
    if (!top) throw new Error("expected a peak");
    expect(
      Math.abs((takeDecayQ(cache, result, top).q ?? 0) / (Math.PI * 190 * 0.12) - 1),
    ).toBeLessThan(0.03);
  });

  it("clipped.wav: tap 2 is rejected as clipped and two taps are used", () => {
    const { result } = analyse("clipped.wav", "plate");
    expect(result.taps.map((t) => t.rejection)).toEqual([null, "clipped", null]);
    expect(result.used).toEqual([1, 3]);
    expect(Math.round(result.peaks[0]?.frequency ?? 0)).toBe(190);
  });

  it("body.wav: Air, Top and Back in Instrument mode", () => {
    const { result } = analyse("body.wav", "instrument");
    expect(result.taps.every((t) => t.rejection === null)).toBe(true);
    expect(
      [result.roles?.air, result.roles?.top, result.roles?.back].map((r) =>
        Math.round(r?.frequency ?? 0),
      ),
    ).toEqual([98, 197, 248]);
  });
});
