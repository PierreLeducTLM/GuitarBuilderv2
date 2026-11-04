// @vitest-environment jsdom
import { measureDecayQ, runTake, takeDecayQ, takeDecaySeries } from "@gb/dsp";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { PeakInspector } from "./PeakInspector";

const SAMPLE_RATE = 48000;
const signal = Float64Array.from({ length: 4 * SAMPLE_RATE }, (_, n) =>
  [24000, 76800, 132000].reduce(
    (total, onset) => {
      if (n < onset) return total;
      const t = (n - onset) / SAMPLE_RATE;
      return total + 0.3 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 190 * t);
    },
    2e-4 * Math.sin(n * 1.7),
  ),
);
const { cache, result } = runTake({
  filtered: signal,
  raw: [signal],
  sampleRate: SAMPLE_RATE,
  mode: "plate",
  mobile: false,
});
const peak = result.peaks[0];
if (!peak) throw new Error("expected a peak");
const decay = takeDecayQ(cache, result, peak);

const withIntl = (node: ReactNode, locale: "en" | "fr" = "en") =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      formats={formats}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>,
  );

describe("PeakInspector", () => {
  it("summarises the decay Q, lists every tap and draws the chosen tap's ring-down", () => {
    withIntl(
      <PeakInspector
        frequency={peak.frequency}
        decay={decay}
        series={takeDecaySeries(cache, result, peak, 2)}
        taps={result.taps}
        chosenTap={2}
        onChooseTap={vi.fn()}
      />,
    );
    expect(screen.getByText(`Decay Q ${Math.round(decay.q ?? 0)} from 3 of 3 taps`)).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(4);
    const graph = screen.getByRole("img", { name: "Ring-down of tap 2 at 190.0 Hz" });
    expect(graph.querySelectorAll("[data-series]")).toHaveLength(3);
    expect(graph.querySelector("[data-marker=start]")).toBeTruthy();
    expect(graph.querySelector("[data-marker=end]")).toBeTruthy();
    expect(graph.querySelector("[data-marker=noise]")).toBeTruthy();
    expect(graph.querySelector("[data-marker=threshold]")).toBeTruthy();
  });

  it("chooses another tap to draw", async () => {
    const onChooseTap = vi.fn();
    withIntl(
      <PeakInspector
        frequency={peak.frequency}
        decay={decay}
        series={null}
        taps={result.taps}
        chosenTap={2}
        onChooseTap={onChooseTap}
      />,
    );
    expect(screen.getByRole("button", { name: "Tap 2" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tap 3" }));
    expect(onChooseTap).toHaveBeenCalledWith(3);
  });

  it("explains a refused decay Q in French and still shows the taps", () => {
    const twoTaps = takeDecayQ(cache, { ...result, used: [1, 2] }, peak);
    withIntl(
      <PeakInspector
        frequency={peak.frequency}
        decay={twoTaps}
        series={null}
        taps={result.taps}
        chosenTap={1}
        onChooseTap={vi.fn()}
      />,
      "fr",
    );
    expect(
      screen.getByText("Moins de 3 frappes exploitables. Enregistrez davantage de frappes."),
    ).toBeTruthy();
    expect(screen.getByText("2 frappes exploitables sur 2")).toBeTruthy();
  });

  it("names the neighbour that is too close and draws nothing", () => {
    const notIsolated = measureDecayQ({
      signal,
      onsets: [24000, 76800, 132000],
      used: [24000, 76800, 132000],
      peak: { frequency: 200, level: -20, bandwidth: null },
      others: [{ frequency: 205, level: -20 }],
    });
    const { container } = withIntl(
      <PeakInspector
        frequency={200}
        decay={notIsolated}
        series={null}
        taps={result.taps}
        chosenTap={1}
        onChooseTap={vi.fn()}
      />,
    );
    expect(screen.getByText("205.0 Hz, 5.0 Hz away; at least 7.0 Hz needed")).toBeTruthy();
    expect(container.querySelector("svg[role=img]")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows progress while the decay is measured", () => {
    withIntl(
      <PeakInspector
        frequency={peak.frequency}
        decay="pending"
        series={null}
        taps={result.taps}
        chosenTap={1}
        onChooseTap={vi.fn()}
      />,
    );
    expect(screen.getByText("Measuring…")).toBeTruthy();
  });
});
