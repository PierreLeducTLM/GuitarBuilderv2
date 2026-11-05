// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { formats } from "@/i18n/config";
import en from "../../../messages/en.json";
import { SpectrumGraph } from "./SpectrumGraph";

const spectrum = {
  frequencies: [10, 100, 187.4, 500, 1000],
  magnitudes: [1, 1, 1, 1, 1],
  magnitudesDb: [-40, -120, -25, -60, -30],
  sampleRate: 48000,
  fftSize: 16384,
  binWidth: 2.9296875,
};

function renderGraph(peak = 187.4) {
  render(
    <NextIntlClientProvider locale="en" messages={en} formats={formats} timeZone="UTC">
      <SpectrumGraph spectrum={spectrum} peak={peak} label="Spectrum of Top, peak at 187.4 Hz" />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("img", { name: "Spectrum of Top, peak at 187.4 Hz" });
}

describe("SpectrumGraph", () => {
  it("labels the grid every 20 dB and at the specified frequencies", () => {
    const svg = renderGraph();
    const db = [...svg.querySelectorAll("[data-grid=db]")].map((label) => label.textContent);
    const hz = [...svg.querySelectorAll("[data-grid=hz]")].map((label) => label.textContent);
    expect(db).toEqual(["0", "-20", "-40", "-60", "-80", "-100"]);
    expect(hz).toEqual(["50", "100", "200", "300", "400", "500", "600"]);
  });

  it("draws a dashed peak marker labelled with the peak", () => {
    const svg = renderGraph();
    const marker = svg.querySelector("[data-testid=peak-marker]");
    expect(marker?.querySelector("line")?.getAttribute("stroke-dasharray")).toBeTruthy();
    expect(marker?.textContent).toBe("187.4 Hz");
  });

  it("draws no peak marker for a peak beyond 600 Hz", () => {
    const svg = renderGraph(720.4);
    expect(svg.querySelector("[data-testid=peak-marker]")).toBeNull();
  });

  it("keeps the label of a peak near 600 Hz inside the plot", () => {
    const svg = renderGraph(580);
    expect(svg.querySelector("[data-testid=peak-marker] text")?.getAttribute("text-anchor")).toBe(
      "end",
    );
  });

  it("plots only 20-600 Hz and clamps levels to the -100 dB floor", () => {
    const svg = renderGraph();
    const points = (svg.querySelector("[data-testid=spectrum-trace]")?.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
    // 100, 187.4 and 500 Hz; 10 Hz and 1000 Hz are outside the axis.
    expect(points).toHaveLength(3);
    const [left, , right] = [44, 0, 586];
    const bottom = 10 + 186;
    expect(points[0]?.[1]).toBeCloseTo(bottom, 0);
    for (const [x] of points) {
      expect(x).toBeGreaterThanOrEqual(left);
      expect(x).toBeLessThanOrEqual(right);
    }
  });
});
