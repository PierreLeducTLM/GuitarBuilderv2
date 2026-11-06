// @vitest-environment jsdom
import type { Peak, SpectrumPoint } from "@gb/dsp";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import { GRAPH, levelY, xOfFrequency } from "@/lib/tap-tone/graph";
import en from "../../../messages/en.json";
import { TapToneSpectrum, type TapToneSpectrumProps } from "./TapToneSpectrum";

const points: readonly SpectrumPoint[] = Array.from({ length: 662 }, (_, i) => ({
  frequency: (21 + i) * 1.46484375,
  magnitude: 0.001,
  db: -60,
}));

const peak = (frequency: number, level: number): Peak => ({
  index: 0,
  frequency,
  level,
  magnitude: 0.1,
});

const mode = (frequency: number, level: number) => ({ frequency, level });

const renderSpectrum = (overrides: Partial<TapToneSpectrumProps> = {}) => {
  const onSelect = vi.fn();
  const onAssignRole = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} formats={formats} timeZone="UTC">
      <TapToneSpectrum
        points={points}
        peaks={[peak(181.8, -20), peak(410.2, -30), peak(204.6, -32)]}
        selected={0}
        onSelect={onSelect}
        onAssignRole={onAssignRole}
        {...overrides}
      />
    </NextIntlClientProvider>,
  );
  const svg = screen.getByRole("img");
  vi.spyOn(svg, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ x: 0, y: 0, width: GRAPH.width, height: GRAPH.height }),
  );
  return { svg, onSelect, onAssignRole };
};

const at = (frequency: number) => ({ clientX: xOfFrequency(frequency), clientY: 50, pointerId: 1 });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TapToneSpectrum", () => {
  it("labels its grid at 50-600 Hz and every 20 dB from 0 to -100", () => {
    const { svg } = renderSpectrum();
    const labels = (kind: string) =>
      [...svg.querySelectorAll(`[data-grid=${kind}]`)].map((l) => l.textContent);
    expect(labels("hz")).toEqual(["50", "100", "200", "300", "400", "500", "600"]);
    expect(labels("db")).toEqual(["0", "-20", "-40", "-60", "-80", "-100"]);
  });

  it("marks every peak, the selected one solid and the others dashed", () => {
    const { svg } = renderSpectrum({ selected: 1 });
    const markers = [...svg.querySelectorAll("[data-peak]")];
    expect(markers.map((m) => m.textContent)).toEqual(["181.8 Hz", "410.2 Hz", "204.6 Hz"]);
    expect(markers.map((m) => m.getAttribute("data-state"))).toEqual([
      "strongest",
      "selected",
      "other",
    ]);
    expect(markers[1]?.querySelector("line")?.getAttribute("stroke-dasharray")).toBeNull();
    expect(markers[2]?.querySelector("line")?.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  it("leaves off the graph the peaks beyond its frequency axis", () => {
    const { svg } = renderSpectrum({ peaks: [peak(720.4, -10), peak(181.8, -20)] });
    expect([...svg.querySelectorAll("[data-peak]")].map((m) => m.textContent)).toEqual([
      "181.8 Hz",
    ]);
  });

  it("names the peaks for screen readers", () => {
    renderSpectrum();
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Frequency spectrum. Peaks: 181.8 Hz, 410.2 Hz, 204.6 Hz",
    );
  });

  it("snaps to a peak within 20 Hz of the pointer without a cursor line", () => {
    const { svg } = renderSpectrum();
    fireEvent.pointerMove(svg, at(175));
    expect(svg.querySelector("[data-peak][data-snap=true]")?.textContent).toBe("181.8 Hz");
    expect(svg.querySelector("[data-cursor]")).toBeNull();
  });

  it("shows the pointer frequency away from peaks, and nothing once it leaves", () => {
    const { svg } = renderSpectrum();
    fireEvent.pointerMove(svg, at(600));
    expect(svg.querySelector("[data-cursor]")?.textContent).toBe("600.0 Hz");
    expect(svg.querySelector("[data-snap=true]")).toBeNull();
    fireEvent.pointerLeave(svg);
    expect(svg.querySelector("[data-cursor]")).toBeNull();
  });

  it("selects the snap target, or else the nearest peak, on click", () => {
    const { svg, onSelect } = renderSpectrum();
    fireEvent.click(svg, at(330));
    fireEvent.click(svg, at(190));
    expect(onSelect.mock.calls).toEqual([[1], [0]]);
  });

  it("draws nothing to select without peaks", () => {
    const { svg, onSelect } = renderSpectrum({ peaks: [], selected: null });
    fireEvent.click(svg, at(300));
    expect(onSelect).not.toHaveBeenCalled();
    expect(svg.getAttribute("aria-label")).toBe("Frequency spectrum, no peak detected");
  });

  it("draws each body mode as a chip in its colour with its frequency", () => {
    const { svg } = renderSpectrum({
      mode: "instrument",
      roles: { air: mode(98.4, -25), back: mode(247.5, -30) },
    });
    const air = svg.querySelector("[data-role=air]");
    expect(air?.textContent).toBe("Air 98.4");
    expect(air?.getAttribute("class")).toContain("text-mode1");
    expect(svg.querySelector("[data-role=back]")?.getAttribute("class")).toContain("text-mode3");
    expect(svg.querySelector("[data-role=back]")?.getAttribute("data-x")).toBe(
      xOfFrequency(247.5).toFixed(1),
    );
    expect(svg.querySelector("[data-role=top]")).toBeNull();
  });

  it("joins each chip to its peak with a leader line", () => {
    const { svg } = renderSpectrum({ mode: "instrument", roles: { air: mode(98.4, -25) } });
    const points = svg.querySelector("[data-role=air] [data-leader]")?.getAttribute("points");
    const last = points?.trim().split(" ").at(-1)?.split(",") ?? [];
    expect(Number(last[0])).toBeCloseTo(xOfFrequency(98.4), 1);
    expect(Number(last[1])).toBeLessThan(levelY(-25));
  });

  for (const width of [GRAPH.width, 358]) {
    it(`keeps close body mode chips apart and inside the plot at ${width} px`, () => {
      vi.stubGlobal(
        "ResizeObserver",
        class {
          constructor(private readonly report: ResizeObserverCallback) {}
          observe(target: Element) {
            this.report(
              [{ target, contentRect: DOMRect.fromRect({ width, height: 200 }) }] as never,
              this as never,
            );
          }
          disconnect() {}
        },
      );
      const { svg } = renderSpectrum({
        mode: "instrument",
        roles: { air: mode(103.4, -16), top: mode(186.7, -14), back: mode(220.8, -21) },
      });
      const chips = (["air", "top", "back"] as const).map((role) => {
        const rect = svg.querySelector(`[data-role=${role}] rect`);
        const x = Number(rect?.getAttribute("x"));
        return { left: x, right: x + Number(rect?.getAttribute("width")) };
      });
      const unit = GRAPH.width / width;
      chips.slice(1).forEach((chip, i) => {
        expect(chip.left - (chips[i]?.right ?? 0)).toBeGreaterThanOrEqual(6 * unit - 1e-6);
      });
      expect(chips[0]?.left).toBeGreaterThanOrEqual(GRAPH.left);
      expect(chips[2]?.right).toBeLessThanOrEqual(GRAPH.left + GRAPH.plotWidth);
    });
  }

  it("makes room above the plot for the chips in Instrument mode only", () => {
    const { svg } = renderSpectrum({ mode: "instrument", roles: { air: mode(98.4, -25) } });
    expect(svg.getAttribute("viewBox")?.split(" ")[1]).toMatch(/^-\d/);
    cleanup();
    const plate = renderSpectrum();
    expect(plate.svg.getAttribute("viewBox")).toBe(`0 0 ${GRAPH.width} ${GRAPH.height}`);
  });

  it("labels only the selected peak and the one under the pointer in Instrument mode", () => {
    const { svg } = renderSpectrum({ mode: "instrument", roles: {} });
    const labels = () => [...svg.querySelectorAll("[data-peak]")].map((m) => m.textContent);
    expect(labels()).toEqual(["181.8 Hz", "", ""]);
    expect(svg.querySelector("[data-peak][data-state=selected] [data-ring]")).not.toBeNull();
    fireEvent.pointerMove(svg, at(405));
    expect(labels()).toEqual(["181.8 Hz", "410.2 Hz", ""]);
  });

  it("leaves the selected peak's frequency to its chip when it is a body mode", () => {
    const { svg } = renderSpectrum({ mode: "instrument", roles: { top: mode(181.8, -20) } });
    expect([...svg.querySelectorAll("[data-peak]")].map((m) => m.textContent)).toEqual([
      "",
      "",
      "",
    ]);
  });

  it("dims the other body modes while one is spotlit", () => {
    const { svg } = renderSpectrum({
      mode: "instrument",
      roles: { air: mode(98.4, -25), top: mode(181.8, -20) },
      focused: "top",
    });
    expect(svg.querySelector("[data-role=air]")?.getAttribute("opacity")).toBe("0.3");
    expect(svg.querySelector("[data-role=top]")?.getAttribute("opacity")).toBe("1");
  });

  it("moves a role chip dropped on a peak, and puts it back when dropped elsewhere", () => {
    const { svg, onAssignRole } = renderSpectrum({
      mode: "instrument",
      roles: { top: mode(410.2, -30) },
    });
    const handle = svg.querySelector("[data-role=top]") ?? svg;
    fireEvent.pointerDown(handle, at(410.2));
    fireEvent.pointerMove(svg, at(600));
    expect(svg.querySelector("[data-role=top]")?.getAttribute("data-x")).toBe(
      xOfFrequency(600).toFixed(1),
    );
    fireEvent.pointerUp(svg, at(600));
    expect(onAssignRole).not.toHaveBeenCalled();
    expect(svg.querySelector("[data-role=top]")?.getAttribute("data-x")).toBe(
      xOfFrequency(410.2).toFixed(1),
    );
    fireEvent.pointerDown(handle, at(410.2));
    fireEvent.pointerMove(svg, at(210));
    fireEvent.pointerUp(svg, at(210));
    expect(onAssignRole).toHaveBeenCalledWith("top", 2);
  });

  it("does not select a peak when a role label is dropped", () => {
    const { svg, onSelect } = renderSpectrum({
      mode: "instrument",
      roles: { air: mode(181.8, -20) },
    });
    fireEvent.pointerDown(svg.querySelector("[data-role=air]") ?? svg, at(181.8));
    fireEvent.pointerUp(svg, at(410.2));
    fireEvent.click(svg, at(410.2));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
