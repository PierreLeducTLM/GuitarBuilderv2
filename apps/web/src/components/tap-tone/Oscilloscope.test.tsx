// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Oscilloscope } from "./Oscilloscope";

const fakeCanvas = () => {
  const calls = {
    lineTo: [] as [number, number][],
    dashes: [] as number[][],
    strokes: [] as string[],
  };
  const context = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: (x: number, y: number) => calls.lineTo.push([x, y]),
    stroke: vi.fn(),
    setLineDash: (dash: number[]) => calls.dashes.push(dash),
    set strokeStyle(value: string) {
      calls.strokes.push(value);
    },
    lineWidth: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as never);
  return calls;
};

const frames = () => {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return { next: () => queue.shift()?.(0), cancel, pending: () => queue.length };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Oscilloscope", () => {
  it("draws the latest 2048 samples across the view, -1 to +1 spanning its height, over a dashed centre line", () => {
    const calls = fakeCanvas();
    const frame = frames();
    const analyser = {
      fftSize: 2048,
      getFloatTimeDomainData: (target: Float32Array) => target.fill(1),
    };
    const { container } = render(<Oscilloscope analyser={analyser} />);
    const canvas = container.querySelector("canvas");
    frame.next();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    expect(calls.dashes[0]).toEqual([4, 4]);
    const trace = calls.lineTo.slice(-2047);
    expect(trace[0]?.[1]).toBe(0);
    expect(trace.at(-1)?.[0]).toBe(canvas?.width);
    expect(frame.pending()).toBe(1);
  });

  it("stops drawing when it goes away", () => {
    fakeCanvas();
    const frame = frames();
    const analyser = { fftSize: 2048, getFloatTimeDomainData: vi.fn() };
    const { unmount } = render(<Oscilloscope analyser={analyser} />);
    unmount();
    expect(frame.cancel).toHaveBeenCalled();
  });

  it.each([
    ["a full-scale sample", 0.999, 1],
    ["a negative full-scale sample", -1, 1],
    ["a sample just below full scale", 0.9989, 0],
  ])("reports clipping for %s", (_, value, reports) => {
    fakeCanvas();
    const frame = frames();
    const onClip = vi.fn();
    const analyser = {
      getFloatTimeDomainData: (target: Float32Array) => {
        target.fill(0.2);
        target[1500] = value;
      },
    };
    render(<Oscilloscope analyser={analyser} onClip={onClip} />);
    frame.next();
    expect(onClip).toHaveBeenCalledTimes(reports);
  });

  it("stays blank without an input", () => {
    const calls = fakeCanvas();
    const frame = frames();
    render(<Oscilloscope analyser={null} />);
    expect(frame.pending()).toBe(0);
    expect(calls.lineTo).toHaveLength(0);
  });
});
