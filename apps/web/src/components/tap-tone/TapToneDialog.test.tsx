// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { forgetChosenInput } from "./hooks";
import { TapToneDialog } from "./TapToneDialog";

const SAMPLE_RATE = 48000;
type Mode = { frequency: number; amplitude: number; tau: number };

const synth = (seconds: number, onsets: readonly number[], modes: readonly Mode[]) =>
  Float32Array.from({ length: seconds * SAMPLE_RATE }, (_, n) =>
    onsets.reduce(
      (total, onset) => {
        if (n < onset) return total;
        const t = (n - onset) / SAMPLE_RATE;
        return (
          total +
          modes.reduce(
            (s, m) =>
              s + m.amplitude * Math.exp(-t / m.tau) * Math.sin(2 * Math.PI * m.frequency * t),
            0,
          )
        );
      },
      2e-4 * Math.sin(n * 1.7),
    ),
  );

const plate = (frequency: number) =>
  synth(4, [24000, 76800, 132000], [{ frequency, amplitude: 0.3, tau: 0.12 }]);
const body = synth(
  5,
  [48000, 105600, 163200],
  [
    { frequency: 98.4, amplitude: 0.25, tau: 0.05 },
    { frequency: 196.9, amplitude: 0.3, tau: 0.06 },
    { frequency: 247.5, amplitude: 0.2, tau: 0.05 },
  ],
);

const decodes: Float32Array[] = [];
const stubBrowser = () => {
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData() {
        const samples = decodes.shift() ?? new Float32Array(0);
        return Promise.resolve({
          numberOfChannels: 1,
          sampleRate: SAMPLE_RATE,
          length: samples.length,
          getChannelData: () => samples,
        });
      }
    },
  );
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: "Mozilla/5.0 (Macintosh)",
    maxTouchPoints: 0,
    mediaDevices: {
      enumerateDevices: async () => [{ deviceId: "default", kind: "audioinput", label: "" }],
      getUserMedia: vi.fn(),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
  });
};

afterEach(() => {
  forgetChosenInput();
  vi.unstubAllGlobals();
  decodes.length = 0;
});

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

const upload = async (samples: Float32Array) => {
  decodes.push(samples);
  const file = new File([new Uint8Array(8)], "tap.wav", { type: "audio/wav" });
  await userEvent.setup().upload(screen.getByLabelText("Upload Audio File"), file);
  await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
};

describe("TapToneDialog in Instrument mode", () => {
  it("analyses a file, labels Air, Top and Back, and confirms the main peak with the roles", async () => {
    stubBrowser();
    const onConfirm = vi.fn();
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analysis for Box closed"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Frequency Detector" })).toBeTruthy();
    expect(screen.getByText("Analysis for Box closed")).toBeTruthy();
    expect(screen.getByText("Max 10 seconds")).toBeTruthy();
    await upload(body);
    expect(screen.getByText("3 of 3 taps used")).toBeTruthy();
    const modes = screen.getByRole("region", { name: "Body modes" });
    expect(
      within(modes)
        .getAllByRole("button")
        .map((tile) => tile.textContent?.match(/\d+\.\d/)?.[0]),
    ).toEqual(["98.1", "196.8", "247.7"]);
    expect(screen.getByRole("region", { name: "Main frequency" }).textContent).toContain(
      "Same peak as Top",
    );
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
    await userEvent.setup().click(confirm);
    const [result] = onConfirm.mock.calls[0] ?? [];
    expect(Math.round(result.frequency)).toBe(197);
    expect(result.spectrum.fftSize).toBe(32768);
    expect(Object.keys(result.roles).sort()).toEqual(["air", "back", "top"]);
    expect(result.roles.top).toMatchObject({ origin: "auto" });
    expect(result.roles.top.decayQ).toBeGreaterThan(0);
  }, 30000);

  it("moves and clears a body mode from its readout", async () => {
    stubBrowser();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analysis"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    await upload(body);
    const modes = screen.getByRole("region", { name: "Body modes" });
    const tile = (name: RegExp) => within(modes).getByRole("button", { name });
    await user.click(tile(/^Back/));
    expect(tile(/^Back/).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("img", { name: /Frequency spectrum/ })
        .querySelector("[data-mark=air]")
        ?.getAttribute("opacity"),
    ).toBe("0.3");
    await user.click(screen.getByRole("button", { name: "Move Back" }));
    expect(within(modes).getByRole("status").textContent).toBe("Choose a peak for Back");
    await user.click(screen.getByRole("button", { name: /^98\.\d Hz$/ }));
    expect(tile(/^Back/).textContent).toMatch(/98\.\d/);
    expect(tile(/^Back/).textContent).toContain("set by you");
    expect(within(modes).getByRole("status").textContent).toBe("");
    await user.click(tile(/^Air/));
    await user.click(screen.getByRole("button", { name: "Clear Air" }));
    expect(tile(/^Air/).textContent).toContain("Not identified");
    const confirm = screen.getByRole("button", { name: "Confirm" });
    await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
    await user.click(confirm);
    const [result] = onConfirm.mock.calls[0] ?? [];
    expect(Object.keys(result.roles).sort()).toEqual(["back", "top"]);
    expect(result.roles.back).toMatchObject({ origin: "user" });
  }, 30000);

  it("refuses an unsupported file and stays idle", async () => {
    stubBrowser();
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analysis"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const file = new File([new Uint8Array(8)], "tap.flac", { type: "audio/flac" });
    await userEvent
      .setup({ applyAccept: false })
      .upload(screen.getByLabelText("Upload Audio File"), file);
    expect(screen.getByRole("alert").textContent).toBe(
      "Unsupported audio format. Supported formats: WAV, MP3, OGG",
    );
    const picker = screen.getByLabelText("Upload Audio File");
    expect(picker instanceof HTMLInputElement && picker.value).toBe("");
    expect(screen.getByRole("button", { name: "Start Recording" })).toBeTruthy();
  });

  it("says no tap was detected in a file without taps", async () => {
    stubBrowser();
    decodes.push(new Float32Array(2 * SAMPLE_RATE));
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analysis"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await userEvent
      .setup()
      .upload(
        screen.getByLabelText("Upload Audio File"),
        new File([new Uint8Array(8)], "quiet.wav", { type: "audio/wav" }),
      );
    expect((await screen.findByRole("alert", {}, { timeout: 10000 })).textContent).toBe(
      "No tap detected. Tap the part firmly and try again.",
    );
  });

  it("is in French with French role names", async () => {
    stubBrowser();
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analyse"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
      "fr",
    );
    expect(screen.getByRole("dialog", { name: "Détecteur de fréquence" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Démarrer l'enregistrement" })).toBeTruthy();
    decodes.push(body);
    await userEvent
      .setup()
      .upload(
        screen.getByLabelText("Importer un fichier audio"),
        new File([new Uint8Array(8)], "tap.wav", { type: "audio/wav" }),
      );
    await screen.findByRole("img", { name: /Spectre de fréquences/ }, { timeout: 10000 });
    expect(screen.getAllByText("Table").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fond").length).toBeGreaterThan(0);
  }, 30000);

  it("returns nothing when cancelled", async () => {
    stubBrowser();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    withIntl(
      <TapToneDialog
        open
        mode="instrument"
        label="Analysis"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(onCancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("TapToneDialog in Plate mode", () => {
  it("measures two of the three modes and returns both on Confirm", async () => {
    stubBrowser();
    const onConfirm = vi.fn();
    withIntl(
      <TapToneDialog
        open
        mode="plate"
        label="Plate measurement"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/22\.4% of its length/)).toBeTruthy();
    await upload(plate(181.8));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Cross-grain/ }));
    expect(screen.getByText(/22\.4% of its width/)).toBeTruthy();
    await upload(plate(92.7));
    expect(screen.getByRole("button", { name: /^Longitudinal \(f_L\) 181\.8 Hz/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Diagonal \(f_LC\) —/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    const [result] = onConfirm.mock.calls[0] ?? [];
    expect(Object.keys(result).sort()).toEqual(["crossGrain", "longitudinal"]);
    expect(Math.round(result.longitudinal.frequency)).toBe(182);
    expect(Math.round(result.crossGrain.frequency)).toBe(93);
    expect(result.crossGrain.spectrum.frequencies).toHaveLength(662);
  }, 30000);

  it("reopens a saved take on its record without a recording", async () => {
    stubBrowser();
    const onConfirm = vi.fn();
    const first = withIntl(
      <TapToneDialog open mode="plate" label="Plate" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    await upload(plate(181.8));
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm" }));
    const saved = onConfirm.mock.calls[0]?.[0].longitudinal.spectrum;
    first.unmount();
    withIntl(
      <TapToneDialog
        open
        mode="plate"
        label="Plate"
        currentValues={{ longitudinal: 180 }}
        savedRecords={{ longitudinal: saved }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Current Value" }).textContent).toContain(
      "180.00 Hz",
    );
    expect(
      screen.getByText("Needs the recording; record the take again to measure it"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  }, 30000);
});
