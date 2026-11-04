// @vitest-environment jsdom
import type { TakePeak } from "@gb/dsp";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import type { RoleView } from "@/lib/tap-tone/machine";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { DetectedFrequency, DetectedPeaks, RolesPanel } from "./panels";

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

const peak = (frequency: number, overrides: Partial<TakePeak> = {}): TakePeak => ({
  index: 0,
  frequency,
  level: -19.875,
  magnitude: 0.1,
  spectralQ: { q: 64.3, bandwidth: 2.83, low: 180.4, high: 183.2 },
  note: "F#3 -30 c",
  ...overrides,
});

describe("Detected Frequency panel", () => {
  it("shows the frequency, level, note and both Q values next to the current value", () => {
    withIntl(
      <DetectedFrequency peak={peak(181.82373046875)} decayQ={{ value: 71.8 }} current={180} />,
    );
    const panel = screen.getByRole("region", { name: "Detected Frequency" });
    expect(panel.textContent).toContain("181.8");
    expect(panel.textContent).toContain("-19.9 dB");
    expect(panel.textContent).toContain("F#3 -30 c");
    expect(screen.getByText("Spectral Q").nextSibling?.textContent).toBe("64");
    expect(screen.getByText("Decay Q").nextSibling?.textContent).toBe("72");
    expect(screen.getByRole("region", { name: "Current Value" }).textContent).toContain(
      "180.00 Hz",
    );
    expect(screen.queryByText("The peak is too broad or merges with a neighbour")).toBeNull();
  });

  it("shows dashes and the reasons when values are missing", () => {
    withIntl(
      <DetectedFrequency
        peak={peak(181.8, { spectralQ: null })}
        decayQ={{ value: null, reason: "noRecording" }}
      />,
    );
    expect(screen.getByText("Spectral Q").nextSibling?.textContent).toBe("—");
    expect(screen.getByText("The peak is too broad or merges with a neighbour")).toBeTruthy();
    expect(
      screen.getByText("Needs the recording; record the take again to measure it"),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Current Value" })).toBeNull();
  });

  it("explains a decay Q the analysis refused, in French too", () => {
    withIntl(
      <DetectedFrequency peak={peak(181.8)} decayQ={{ value: null, reason: "NOT_EXPONENTIAL" }} />,
      "fr",
    );
    expect(
      screen.getByText(
        "La décroissance ne suit pas une courbe régulière, souvent parce que deux résonances battent ensemble.",
      ),
    ).toBeTruthy();
  });

  it("shows a dash for the frequency when nothing is selected, and progress while decay Q is measured", () => {
    withIntl(<DetectedFrequency peak={undefined} decayQ="pending" />);
    expect(screen.getByRole("region", { name: "Detected Frequency" }).textContent).toContain("—");
    withIntl(<DetectedFrequency peak={peak(181.8)} decayQ="pending" />);
    expect(screen.getByText("Measuring…")).toBeTruthy();
  });
});

describe("Detected Peaks list", () => {
  it("lists the first 5 peaks, marks the highest and the selected one, and selects on click", async () => {
    const onSelect = vi.fn();
    const peaks = [181.6, 92.8, 410.2, 300.1, 500.3, 620.7].map((f) => peak(f));
    withIntl(<DetectedPeaks peaks={peaks} selected={1} onSelect={onSelect} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "181.6 Hz (highest)",
      "92.8 Hz",
      "410.2 Hz",
      "300.1 Hz",
      "500.3 Hz",
    ]);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    await userEvent.setup().click(buttons[2] ?? document.body);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("is not shown with a single peak", () => {
    const { container } = withIntl(
      <DetectedPeaks peaks={[peak(181.6)]} selected={0} onSelect={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("Roles panel", () => {
  const role = (frequency: number, origin: "auto" | "user" = "auto"): RoleView => ({
    frequency,
    level: -20,
    spectralQ: 30,
    origin,
  });

  it("lists Air, Top and Back with their frequency, origin, or Not identified", () => {
    withIntl(
      <RolesPanel
        roles={{ air: role(98.4), top: role(204.6, "user"), back: null }}
        moving={null}
        onMove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows[0]).toContain("Air");
    expect(rows[0]).toContain("98.4 Hz");
    expect(rows[0]).not.toContain("set by you");
    expect(rows[1]).toContain("204.6 Hz");
    expect(rows[1]).toContain("set by you");
    expect(rows[2]).toContain("Not identified");
  });

  it("starts moving a role and clears one from the keyboard", async () => {
    const onMove = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    withIntl(
      <RolesPanel
        roles={{ air: role(98.4), top: role(196.9), back: null }}
        moving={null}
        onMove={onMove}
        onClear={onClear}
      />,
    );
    screen.getByRole("button", { name: "Move Top" }).focus();
    await user.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledWith("top");
    await user.click(screen.getByRole("button", { name: "Clear Air" }));
    expect(onClear).toHaveBeenCalledWith("air");
    expect(screen.queryByRole("button", { name: "Clear Back" })).toBeNull();
  });

  it("asks for a peak while a role is moving", () => {
    withIntl(
      <RolesPanel
        roles={{ air: null, top: null, back: null }}
        moving="back"
        onMove={vi.fn()}
        onClear={vi.fn()}
      />,
      "fr",
    );
    expect(screen.getByRole("status").textContent).toBe("Choisissez un pic pour Fond");
  });
});
