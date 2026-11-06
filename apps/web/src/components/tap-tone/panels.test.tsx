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
import { BodyModes, type BodyModeView, MainFrequency, PlateTakes } from "./panels";

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

describe("Plate takes", () => {
  const renderTakes = (
    overrides: Partial<Parameters<typeof PlateTakes>[0]> = {},
    locale: "en" | "fr" = "en",
  ) => {
    const onSwitch = vi.fn();
    withIntl(
      <PlateTakes
        selected={{ longitudinal: peak(181.8), crossGrain: peak(92.7, { note: "F#2 -12 c" }) }}
        active="crossGrain"
        recording={false}
        onSwitch={onSwitch}
        {...overrides}
      />,
      locale,
    );
    return onSwitch;
  };

  const tile = (name: RegExp) => screen.getByRole("button", { name });

  it("shows each take's symbol, selected frequency and note, or a dash", () => {
    renderTakes();
    const longitudinal = tile(/^Longitudinal/).textContent;
    expect(longitudinal).toContain("fL");
    expect(longitudinal).toContain("181.8");
    expect(longitudinal).toContain("F#3 -30 c");
    expect(tile(/^Cross-grain/).textContent).toContain("92.7");
    expect(tile(/^Diagonal/).textContent).toContain("fLC");
    expect(tile(/^Diagonal/).textContent).toContain("—");
  });

  it("presses the active take and switches take on click", async () => {
    const onSwitch = renderTakes();
    expect(tile(/^Cross-grain/).getAttribute("aria-pressed")).toBe("true");
    expect(tile(/^Longitudinal/).getAttribute("aria-pressed")).toBe("false");
    await userEvent.setup().click(tile(/^Diagonal/));
    expect(onSwitch).toHaveBeenCalledWith("diagonal");
  });

  it("keeps the other takes out of reach while recording", () => {
    renderTakes({ recording: true });
    expect(tile(/^Longitudinal/).hasAttribute("disabled")).toBe(true);
    expect(tile(/^Cross-grain/).hasAttribute("disabled")).toBe(false);
  });

  it("names the takes in French", () => {
    renderTakes({}, "fr");
    expect(tile(/^Travers/).textContent).toContain("92,7");
    expect(tile(/^Diagonale/)).toBeTruthy();
  });
});

describe("Selected frequency of a plate take", () => {
  const plateSection = (
    overrides: Partial<Parameters<typeof MainFrequency>[0]> = {},
    locale: "en" | "fr" = "en",
  ) =>
    withIntl(
      <MainFrequency
        peak={peak(181.82373046875)}
        decayQ={{ value: 71.8 }}
        context={{ mode: "plate", take: "longitudinal", current: 180 }}
        peaks={[peak(181.8)]}
        selected={0}
        onSelect={vi.fn()}
        {...overrides}
      />,
      locale,
    );

  it("is headed by the take and compares with the current value", () => {
    plateSection();
    const section = screen.getByRole("region", { name: "Longitudinal (f_L)" });
    expect(section.textContent).toContain("181.8");
    expect(section.textContent).toContain("Current value 180.00 Hz");
    expect(section.textContent).toContain("-19.9 dB · F#3 -30 c · Q 64 · decay 72");
    expect(section.textContent).not.toContain("Same peak");
  });

  it("shows no current value when the caller has none", () => {
    plateSection({ context: { mode: "plate", take: "diagonal" } });
    expect(screen.getByRole("region", { name: "Diagonal (f_LC)" }).textContent).not.toContain(
      "Current value",
    );
  });

  it("explains a decay Q the analysis refused, in French too", () => {
    plateSection({ decayQ: { value: null, reason: "NOT_EXPONENTIAL" } }, "fr");
    expect(screen.getByRole("region", { name: "Longitudinal (f_L)" }).textContent).toContain(
      "Valeur actuelle 180,00 Hz",
    );
    expect(
      screen.getByText(
        "La décroissance ne suit pas une courbe régulière, souvent parce que deux résonances battent ensemble.",
      ),
    ).toBeTruthy();
  });

  it("lists the first 5 peaks, marks the highest and the selected one, and selects on click", async () => {
    const onSelect = vi.fn();
    const peaks = [181.6, 92.8, 410.2, 300.1, 500.3, 620.7].map((f) => peak(f));
    plateSection({ peaks, selected: 1, onSelect });
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
        context={{ mode: "instrument", sameAs: "top" }}
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
        context={{ mode: "instrument", sameAs: null }}
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
        context={{ mode: "instrument", sameAs: null }}
        peaks={[]}
        selected={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Main frequency" }).textContent).toContain("—");
  });
});
