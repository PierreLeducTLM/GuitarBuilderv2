// @vitest-environment jsdom
import type { TakePeak } from "@gb/dsp";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import {
  BodyModes,
  type BodyModeView,
  DetectedFrequency,
  DetectedPeaks,
  MainFrequency,
} from "./panels";

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

describe("Body modes", () => {
  const found = (frequency: number, overrides: Partial<BodyModeView> = {}): BodyModeView => ({
    frequency,
    spectralQ: 26.2,
    decayQ: { value: 31.4 },
    origin: "auto",
    ...overrides,
  });

  const renderModes = (
    overrides: Partial<Parameters<typeof BodyModes>[0]> = {},
    locale: "en" | "fr" = "en",
  ) => {
    const handlers = { onFocus: vi.fn(), onMove: vi.fn(), onClear: vi.fn() };
    withIntl(
      <BodyModes
        modes={{ air: found(103.4), top: found(186.7, { origin: "user" }), back: null }}
        focused={null}
        moving={false}
        {...handlers}
        {...overrides}
      />,
      locale,
    );
    return handlers;
  };

  const tile = (name: RegExp) => screen.getByRole("button", { name });

  it("shows each mode's number, frequency, note and both Q values", () => {
    renderModes();
    const air = tile(/^Air/).textContent;
    expect(air).toContain("T(1,1)₁");
    expect(air).toContain("103.4");
    expect(air).toContain("Hz");
    expect(air).toContain("Ab2 -7 c");
    expect(air).toContain("Q 26 · decay 31");
    expect(air).not.toContain("set by you");
    expect(tile(/^Top/).textContent).toContain("T(1,1)₂");
    expect(tile(/^Top/).textContent).toContain("set by you");
  });

  it("shows a dash and Not identified for a mode that was not found", () => {
    renderModes();
    const back = tile(/^Back/).textContent;
    expect(back).toContain("T(1,1)₃");
    expect(back).toContain("—");
    expect(back).toContain("Not identified");
  });

  it("shows dashes for missing Q values and progress while decay Q is measured", () => {
    renderModes({
      modes: {
        air: found(103.4, { spectralQ: null, decayQ: { value: null, reason: "NO_DECAY" } }),
        top: found(186.7, { decayQ: "pending" }),
        back: null,
      },
    });
    expect(tile(/^Air/).textContent).toContain("Q — · decay —");
    expect(tile(/^Top/).textContent).toContain("Q 26 · decay …");
  });

  it("spotlights the chosen mode and offers Move and Clear for it", async () => {
    const user = userEvent.setup();
    const handlers = renderModes({ focused: "top" });
    expect(tile(/^Top/).getAttribute("aria-pressed")).toBe("true");
    expect(tile(/^Air/).getAttribute("aria-pressed")).toBe("false");
    await user.click(tile(/^Air/));
    expect(handlers.onFocus).toHaveBeenCalledWith("air");
    await user.click(screen.getByRole("button", { name: "Move Top" }));
    expect(handlers.onMove).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Clear Top" }));
    expect(handlers.onClear).toHaveBeenCalledWith("top");
  });

  it("offers no actions until a mode is chosen", () => {
    renderModes();
    expect(screen.queryByRole("button", { name: /^Move|^Clear|^Assign/ })).toBeNull();
  });

  it("offers to assign a peak to a chosen mode that was not found", () => {
    renderModes({ focused: "back" });
    expect(screen.getByRole("button", { name: "Assign Back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear Back" })).toBeNull();
  });

  it("asks for a peak while a mode is moving, in French too", () => {
    renderModes({ focused: "back", moving: true }, "fr");
    expect(screen.getByRole("status").textContent).toBe("Choisissez un pic pour Fond");
    expect(
      screen.getByRole("button", { name: "Attribuer Fond" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(tile(/^Table/).textContent).toContain("Q 26 · amort. 31");
  });
});

describe("Main frequency", () => {
  const peaks = [186.7, 103.4, 220.8].map((f) => peak(f, { level: -13.84, note: "F#3 +16 c" }));

  it("shows the main peak, the body mode it matches, its details and the peak buttons", async () => {
    const onSelect = vi.fn();
    withIntl(
      <MainFrequency
        peak={peaks[0]}
        decayQ={{ value: 52.3 }}
        sameAs="top"
        peaks={peaks}
        selected={0}
        onSelect={onSelect}
      />,
    );
    const section = screen.getByRole("region", { name: "Main frequency" });
    expect(section.textContent).toContain("186.7");
    expect(section.textContent).toContain("Same peak as Top");
    expect(section.textContent).toContain("-13.8 dB · F#3 +16 c · Q 64 · decay 52");
    const buttons = [...section.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toEqual(["186.7 Hz (highest)", "103.4 Hz", "220.8 Hz"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "103.4 Hz" }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("explains missing values and says nothing about body modes when none matches", () => {
    withIntl(
      <MainFrequency
        peak={peak(412, { spectralQ: null })}
        decayQ={{ value: null, reason: "noRecording" }}
        sameAs={null}
        peaks={[peak(412)]}
        selected={0}
        onSelect={vi.fn()}
      />,
      "fr",
    );
    const section = screen.getByRole("region", { name: "Fréquence principale" });
    expect(section.textContent).toContain("Q — · amort. —");
    expect(section.textContent).not.toContain("Même pic");
    expect(section.querySelectorAll("button")).toHaveLength(0);
    expect(screen.getByText("Le pic est trop large ou se confond avec un voisin")).toBeTruthy();
  });

  it("shows a dash without a selected peak", () => {
    withIntl(
      <MainFrequency
        peak={undefined}
        decayQ="pending"
        sameAs={null}
        peaks={[]}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Main frequency" }).textContent).toContain("—");
  });
});
