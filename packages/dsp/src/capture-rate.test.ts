import { describe, expect, it } from "vitest";
import { judgeRate } from "./index.ts";

type Capture = Parameters<typeof judgeRate>[0];

const capture = (overrides: Partial<Capture> = {}): Capture => ({
  elapsedSeconds: 5,
  statedRate: 48000,
  decodedSeconds: 5,
  frames: { delivered: 240000, dropped: 0 },
  ...overrides,
});

const withFrames = (delivered: number, dropped = 0, overrides: Partial<Capture> = {}) =>
  judgeRate(capture({ frames: { delivered, dropped }, ...overrides }));

describe("capture rate verdict from frame counts", () => {
  it("corrects an interface read at 44,100 Hz while the browser states 48,000 Hz", () => {
    const verdict = withFrames(220500);
    expect(verdict).toEqual({
      verdict: "corrected",
      trueRate: 44100,
      measuredRate: 44100,
      cents: expect.closeTo(146.71, 2),
    });
  });

  it("finds a healthy 48 kHz input accurate", () => {
    expect(withFrames(240000)).toEqual({ verdict: "accurate", measuredRate: 48000, cents: 0 });
  });

  it("refuses a capture that dropped 2% of its audio", () => {
    expect(withFrames(245000, 5000)).toMatchObject({ verdict: "mismatch", reason: "dropped" });
  });

  it("accepts exactly 1% of dropped audio", () => {
    expect(withFrames(237600, 2400)).toMatchObject({ verdict: "accurate" });
  });

  it("refuses a rate that is not standard", () => {
    expect(withFrames(210000)).toEqual({
      verdict: "mismatch",
      reason: "rate",
      measuredRate: 42000,
      cents: expect.closeTo(231.17, 2),
    });
  });

  it("treats up to 3% of timing error as accurate", () => {
    expect(withFrames(233000)).toMatchObject({ verdict: "accurate", measuredRate: 46600 });
    expect(withFrames(247000)).toMatchObject({ verdict: "accurate", measuredRate: 49400 });
  });

  it("treats exactly 3% of timing error as accurate", () => {
    expect(withFrames(232800)).toMatchObject({ verdict: "accurate", measuredRate: 46560 });
    expect(withFrames(247200)).toMatchObject({ verdict: "accurate", measuredRate: 49440 });
  });

  it("snaps a rate exactly 1% from a standard rate", () => {
    expect(withFrames(222705)).toMatchObject({ verdict: "corrected", trueRate: 44100 });
    expect(withFrames(218295)).toMatchObject({ verdict: "corrected", trueRate: 44100 });
  });

  it("does not snap a rate just over 3% off back to the stated rate", () => {
    expect(withFrames(232500)).toMatchObject({ verdict: "mismatch", reason: "rate" });
    expect(withFrames(247500)).toMatchObject({ verdict: "mismatch", reason: "rate" });
  });

  it("snaps to a standard rate within 1%, on either side", () => {
    expect(withFrames(222600)).toMatchObject({ verdict: "corrected", trueRate: 44100 });
    expect(withFrames(218400)).toMatchObject({ verdict: "corrected", trueRate: 44100 });
  });

  it("refuses a rate just over 1% from the nearest standard rate", () => {
    expect(withFrames(222800)).toMatchObject({ verdict: "mismatch", reason: "rate" });
    expect(withFrames(218200)).toMatchObject({ verdict: "mismatch", reason: "rate" });
  });

  it("snaps to the nearest standard rate, low or high", () => {
    expect(withFrames(80000)).toMatchObject({ verdict: "corrected", trueRate: 16000 });
    expect(withFrames(480000)).toMatchObject({ verdict: "corrected", trueRate: 96000 });
  });

  it("gives a negative error when the input runs faster than stated", () => {
    expect(withFrames(240000, 0, { statedRate: 44100 })).toEqual({
      verdict: "corrected",
      trueRate: 48000,
      measuredRate: 48000,
      cents: expect.closeTo(-146.71, 2),
    });
  });

  it("measures the rate over the real elapsed time", () => {
    expect(withFrames(441000, 0, { elapsedSeconds: 10 })).toMatchObject({
      verdict: "corrected",
      measuredRate: 44100,
    });
  });
});
