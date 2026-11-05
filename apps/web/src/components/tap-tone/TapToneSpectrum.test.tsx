// @vitest-environment jsdom
import type { Peak, SpectrumPoint } from "@gb/dsp";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import { GRAPH, xOfFrequency } from "@/lib/tap-tone/graph";
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

afterEach(() => vi.restoreAllMocks());

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

  it("labels each role at its frequency", () => {
    const { svg } = renderSpectrum({ roles: { air: 98.4, back: 247.5 } });
    expect(svg.querySelector("[data-role=air]")?.textContent).toBe("Air");
    expect(svg.querySelector("[data-role=back]")?.getAttribute("data-x")).toBe(
      xOfFrequency(247.5).toFixed(1),
    );
    expect(svg.querySelector("[data-role=top]")).toBeNull();
  });

  it("moves a role label dropped on a peak, and puts it back when dropped elsewhere", () => {
    const { svg, onAssignRole } = renderSpectrum({ roles: { top: 410.2 } });
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
    const { svg, onSelect } = renderSpectrum({ roles: { air: 181.8 } });
    fireEvent.pointerDown(svg.querySelector("[data-role=air]") ?? svg, at(181.8));
    fireEvent.pointerUp(svg, at(410.2));
    fireEvent.click(svg, at(410.2));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
