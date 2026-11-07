// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import { rememberCheck } from "@/lib/microphone-check/memory";
import { checkSignal, stubRecordingBrowser } from "@/test/recording-browser";
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
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    const takes = screen.getByRole("group", { name: "Plate mode" });
    expect(within(takes).getByRole("button", { name: /^Longitudinal/ }).textContent).toContain(
      "181.8",
    );
    expect(within(takes).getByRole("button", { name: /^Diagonal/ }).textContent).toContain("—");
    expect(
      within(takes)
        .getByRole("button", { name: /^Cross-grain/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const spectrum = screen.getByRole("img", { name: /Frequency spectrum/ });
    expect(spectrum.querySelector("[data-mark=crossGrain]")?.textContent).toMatch(/^fC 9[23]\.\d$/);
    expect(spectrum.querySelectorAll("[data-mark]")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Cross-grain (f_C)" }).textContent).toMatch(
      /9[23]\.\d/,
    );
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
    expect(screen.getByRole("region", { name: "Longitudinal (f_L)" }).textContent).toContain(
      "Current value 180.00 Hz",
    );
    expect(
      screen.getByText("Needs the recording; record the take again to measure it"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  }, 30000);
});

const stubRecording = (options: { stats?: boolean; inputLevel?: number } = {}) => {
  stubBrowser();
  const track: {
    stop: () => void;
    getSettings: () => { sampleRate: number };
    stats?: { totalFrames: number; deliveredFrames: number };
  } = {
    stop: vi.fn(),
    getSettings: () => ({ sampleRate: SAMPLE_RATE }),
    ...(options.stats === false ? {} : { stats: { totalFrames: 0, deliveredFrames: 0 } }),
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { ...navigator.mediaDevices, getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported = () => true;
      readonly mimeType = "audio/webm;codecs=pcm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstart: (() => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.ondataavailable?.({ data: new Blob(["pcm"]) });
        this.onstart?.();
      }
      stop() {
        this.onstop?.();
      }
    },
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      createAnalyser = () => ({
        fftSize: 0,
        getFloatTimeDomainData: (target: Float32Array) => target.fill(options.inputLevel ?? 0.2),
      });
      createMediaStreamSource = () => ({ connect: vi.fn() });
      close = async () => undefined;
    },
  );
  const context = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  return { track, clock, nextFrame: () => frames.shift()?.(0) };
};

const ENGLISH_BUTTONS = { start: "Start Recording", stop: "Stop Recording" };

const record = async (
  browser: ReturnType<typeof stubRecording>,
  take: { samples: Float32Array; seconds: number; delivered: number; dropped?: number },
  buttons = ENGLISH_BUTTONS,
) => {
  decodes.push(take.samples);
  const user = userEvent.setup();
  const counted = browser.track.stats !== undefined;
  browser.clock.mockReturnValue(0);
  if (counted) browser.track.stats = { totalFrames: 0, deliveredFrames: 0 };
  await user.click(screen.getByRole("button", { name: buttons.start }));
  if (counted) {
    browser.track.stats = {
      totalFrames: take.delivered + (take.dropped ?? 0),
      deliveredFrames: take.delivered,
    };
  }
  browser.clock.mockReturnValue(take.seconds * 1000);
  await user.click(await screen.findByRole("button", { name: buttons.stop }));
};

const plateDialog = (locale: "en" | "fr" = "en", onConfirm = vi.fn()) =>
  withIntl(
    <TapToneDialog open mode="plate" label="Plate" onConfirm={onConfirm} onCancel={vi.fn()} />,
    locale,
  );

const correctedNote =
  "Corrected: this input runs at 44,100 Hz, not the 48,000 Hz the browser reports.";
const mismatchBanner =
  "This audio input does not deliver audio at a rate the app can correct, so the frequencies would be wrong. Set the interface to 48 kHz in your computer's audio settings (Audio MIDI Setup on a Mac), or record with another app and load the WAV file here.";

describe("TapToneDialog rate check", () => {
  it("analyses an accurate recording as before, with no correction note", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, { samples: plate(181.8), seconds: 4, delivered: 192000 });
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    expect(screen.getByRole("region", { name: "Longitudinal (f_L)" }).textContent).toMatch(
      /181\.\d/,
    );
    expect(screen.queryByText(/^Corrected:/)).toBeNull();
  }, 30000);

  it("corrects a recording from an input at 44,100 Hz labelled 48,000 Hz", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, {
      samples: plate((181.8 * 48000) / 44100),
      seconds: 192000 / 44100,
      delivered: 192000,
    });
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    expect(screen.getByRole("region", { name: "Longitudinal (f_L)" }).textContent).toMatch(
      /181\.\d/,
    );
    expect(screen.getByText(correctedNote)).toBeTruthy();
  }, 30000);

  it("returns the usual 48 kHz record for a corrected take", async () => {
    const browser = stubRecording();
    const onConfirm = vi.fn();
    plateDialog("en", onConfirm);
    await record(browser, {
      samples: plate((181.8 * 48000) / 44100),
      seconds: 192000 / 44100,
      delivered: 192000,
    });
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    await userEvent.setup().click(screen.getByRole("button", { name: "Confirm" }));
    const { spectrum } = onConfirm.mock.calls[0]?.[0].longitudinal ?? {};
    expect(spectrum).toMatchObject({ sampleRate: 48000, fftSize: 32768, binWidth: 1.46484375 });
    expect(spectrum.frequencies).toHaveLength(662);
  }, 30000);

  it("corrects from the recording's length when the browser reports no frame counts", async () => {
    const browser = stubRecording({ stats: false });
    plateDialog();
    await record(browser, {
      samples: plate((181.8 * 48000) / 44100),
      seconds: 192000 / 44100,
      delivered: 0,
    });
    await screen.findByRole("img", { name: /Frequency spectrum/ }, { timeout: 10000 });
    expect(screen.getByText(correctedNote)).toBeTruthy();
  }, 30000);

  it("says the audio could not be processed when a recording holds no audio", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, { samples: new Float32Array(0), seconds: 4, delivered: 192000 });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error processing audio. Please try again.",
    );
  });

  it("refuses a recording at a rate it cannot correct, without analysing it", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, { samples: plate(181.8), seconds: 5, delivered: 210000 });
    expect((await screen.findByRole("alert")).textContent).toBe(mismatchBanner);
    expect(screen.getByRole("button", { name: "Start Recording" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Frequency spectrum/ })).toBeNull();
  });

  it("refuses a recording that dropped too much audio", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, { samples: plate(181.8), seconds: 4, delivered: 188000, dropped: 4000 });
    expect((await screen.findByRole("alert")).textContent).toBe(mismatchBanner);
  });

  it("clears the banner and analyses a loaded file without a rate check", async () => {
    const browser = stubRecording();
    plateDialog();
    await record(browser, { samples: plate(181.8), seconds: 5, delivered: 210000 });
    await screen.findByRole("alert");
    await upload(plate(181.8));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/^Corrected:/)).toBeNull();
  }, 30000);

  it("shows the correction note and the banner in French", async () => {
    const browser = stubRecording();
    plateDialog("fr");
    const french = { start: "Démarrer l'enregistrement", stop: "Arrêter l'enregistrement" };
    await record(browser, { samples: plate(181.8), seconds: 5, delivered: 210000 }, french);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Cette entrée audio ne fournit pas le son à une fréquence que l'application peut corriger, les fréquences seraient donc fausses. Réglez l'interface sur 48 kHz dans les réglages audio de votre ordinateur (Configuration audio et MIDI sur Mac), ou enregistrez avec une autre application et chargez le fichier WAV ici.",
    );
    await record(
      browser,
      { samples: plate((181.8 * 48000) / 44100), seconds: 192000 / 44100, delivered: 192000 },
      french,
    );
    await screen.findByRole("img", { name: /Spectre/ }, { timeout: 10000 });
    expect(
      screen.getByText(
        /^Corrigé : cette entrée fonctionne à 44\s100 Hz, et non aux 48\s000 Hz annoncés par le navigateur\.$/,
      ),
    ).toBeTruthy();
  }, 30000);
});

describe("TapToneDialog clipping warnings", () => {
  const startRecording = async (inputLevel: number) => {
    const browser = stubRecording({ inputLevel });
    plateDialog();
    await userEvent.setup().click(screen.getByRole("button", { name: "Start Recording" }));
    await screen.findByRole("button", { name: "Stop Recording" });
    act(() => browser.nextFrame());
    return screen.getByTestId("clip-indicator");
  };

  it("shows Clipping beside the oscilloscope when the input reaches full scale", async () => {
    const indicator = await startRecording(1);
    expect(indicator.textContent).toBe("Clipping");
    expect(indicator.getAttribute("aria-live")).toBe("polite");
  });

  it("stays quiet below full scale", async () => {
    expect((await startRecording(0.5)).textContent).toBe("");
  });

  it("counts the clipped taps of a loaded file", async () => {
    stubBrowser();
    plateDialog();
    const clipped = plate(181.8).map((x, n) => (n === 24010 || n === 76810 ? 1 : x));
    await upload(clipped);
    expect(
      screen.getByText("2 of 3 taps clipped. Tap more lightly or turn the input gain down."),
    ).toBeTruthy();
  }, 30000);
});

describe("TapToneDialog input check status", () => {
  const accurate = {
    checkedAt: "2026-11-07T14:00:00.000Z",
    rate: "accurate" as const,
    measuredRate: 48000,
    level: "good" as const,
  };

  it("says an input has not been checked and offers to check it", async () => {
    stubBrowser();
    plateDialog();
    expect(await screen.findByText("Not checked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check this input" })).toBeTruthy();
  });

  it("shows the selected input's last check", async () => {
    stubBrowser();
    rememberCheck(() => localStorage, { id: "default", label: null }, accurate);
    plateDialog();
    expect(await screen.findByText("Checked Nov 7, 2026: Accurate")).toBeTruthy();
  });

  it("opens the Microphone Check over the dialog and returns to the take unchanged", async () => {
    stubBrowser();
    plateDialog();
    await upload(plate(181.8));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^Cross-grain/ }));
    await user.click(screen.getByRole("button", { name: "Check this input" }));
    expect(screen.getByRole("dialog", { name: "Microphone Check" })).toBeTruthy();
    const check = screen.getByRole("dialog", { name: "Microphone Check" });
    await user.click(within(check).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Microphone Check" })).toBeNull();
    const takes = screen.getByRole("group", { name: "Plate mode" });
    expect(within(takes).getByRole("button", { name: /^Longitudinal/ }).textContent).toContain(
      "181.8",
    );
    expect(screen.getByRole("button", { name: "Start Recording" })).toBeTruthy();
  }, 30000);

  it("keeps the input chosen in the check and shows that check's result", async () => {
    const browser = stubRecordingBrowser();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-11-07T14:00:00Z"));
    plateDialog();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Check this input" }));
    const check = screen.getByRole("dialog", { name: "Microphone Check" });
    await user.selectOptions(await within(check).findByLabelText("Input device"), "builtin");
    const finish = browser.prepare({
      samples: checkSignal({ length: 5 * SAMPLE_RATE, tapAmplitude: 0.5 }),
      seconds: 5,
      delivered: 240000,
    });
    await user.click(within(check).getByRole("button", { name: "Start check" }));
    finish();
    act(() => vi.advanceTimersByTime(5000));
    await within(check).findByText("Good level.");
    await user.click(within(check).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Input device") as HTMLSelectElement).value).toBe("builtin"),
    );
    expect(screen.getByText("Checked Nov 7, 2026: Accurate")).toBeTruthy();
  }, 30000);
});
