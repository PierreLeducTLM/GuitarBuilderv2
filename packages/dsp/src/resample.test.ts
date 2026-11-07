import { describe, expect, it } from "vitest";
import { measureTone, resample } from "./index.ts";
import { sine } from "./test-support/signals.ts";

describe("resampling", () => {
  it("keeps the duration when converting 44,100 Hz audio to 48,000 Hz", () => {
    const samples = new Float32Array(3 * 44100);
    expect(resample({ samples, fromRate: 44100, toRate: 48000 })).toHaveLength(144000);
  });

  it("keeps the pitch of a tone", () => {
    const samples = Float32Array.from(
      sine({ frequency: 440, sampleRate: 44100, length: 3 * 44100 }),
    );
    const converted = resample({ samples, fromRate: 44100, toRate: 48000 });
    expect(measureTone({ samples: converted, sampleRate: 48000 })).toMatchObject({
      heard: true,
      frequency: expect.closeTo(440, 1),
    });
  });

  it("interpolates linearly between samples, holding the last one", () => {
    expect([...resample({ samples: Float32Array.of(0, 1), fromRate: 1, toRate: 2 })]).toEqual([
      0, 0.5, 1, 1,
    ]);
  });

  it("picks every other sample when halving the rate", () => {
    expect([...resample({ samples: Float32Array.of(0, 1, 2, 3), fromRate: 2, toRate: 1 })]).toEqual(
      [0, 2],
    );
  });

  it("leaves audio at the same rate unchanged", () => {
    const samples = Float32Array.of(0.1, -0.4, 0.9, -0.2);
    expect(resample({ samples, fromRate: 48000, toRate: 48000 })).toEqual(samples);
  });
});
