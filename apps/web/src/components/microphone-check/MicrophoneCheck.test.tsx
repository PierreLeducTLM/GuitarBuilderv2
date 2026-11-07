// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/i18n/config";
import { readCheck } from "@/lib/microphone-check/memory";
import { checkSignal, SAMPLE_RATE, stubRecordingBrowser } from "@/test/recording-browser";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { forgetChosenInput } from "../tap-tone/hooks";
import { MicrophoneCheck } from "./MicrophoneCheck";

afterEach(() => {
  forgetChosenInput();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const showCheck = (locale: "en" | "fr" = "en", onClose = vi.fn()) => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date("2026-11-07T14:00:00Z"));
  const view = (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      formats={formats}
      timeZone="UTC"
    >
      <MicrophoneCheck open onClose={onClose} />
    </NextIntlClientProvider>
  );
  return { ...render(view), view };
};

const runCheck = async (
  browser: ReturnType<typeof stubRecordingBrowser>,
  take: { samples: Float32Array; delivered: number },
  startLabel = /^(Start check|Check again|Lancer la vérification)$/,
) => {
  const finish = browser.prepare({ ...take, seconds: 5 });
  await userEvent.setup().click(await screen.findByRole("button", { name: startLabel }));
  finish();
  act(() => vi.advanceTimersByTime(5000));
};

const fiveSeconds = (tapAmplitude?: number) =>
  checkSignal({ length: 5 * SAMPLE_RATE, ...(tapAmplitude === undefined ? {} : { tapAmplitude }) });

describe("Microphone Check", () => {
  it("opens on the page's input with its remembered state, without asking for the microphone", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    expect(screen.getByRole("dialog", { name: "Microphone Check" })).toBeTruthy();
    expect(((await screen.findByLabelText("Input device")) as HTMLSelectElement).value).toBe(
      "default",
    );
    expect(screen.getByText("Not checked")).toBeTruthy();
    expect(screen.queryByText("Tap a part 2 or 3 times while the check records")).toBeNull();
    expect(browser.getUserMedia).not.toHaveBeenCalled();
  });

  it("opens on the input chosen earlier on the page", async () => {
    stubRecordingBrowser();
    const { unmount, view } = showCheck();
    await userEvent.setup().selectOptions(await screen.findByLabelText("Input device"), "builtin");
    unmount();
    render(view);
    await screen.findAllByRole("option");
    expect((screen.getByLabelText("Input device") as HTMLSelectElement).value).toBe("builtin");
  });

  it("closes, releasing the microphone when it is recording", async () => {
    const browser = stubRecordingBrowser();
    const onClose = vi.fn();
    showCheck("en", onClose);
    browser.prepare({ samples: fiveSeconds(0.5), seconds: 5, delivered: 240000 });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Start check" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(browser.track.stop).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(/^Stated/)).toBeNull();
  });

  it("hides the selector when the browser lists no input", async () => {
    const browser = stubRecordingBrowser({ devices: "none" });
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 240000 });
    expect(await screen.findByText("Good level.")).toBeTruthy();
    expect(screen.queryByLabelText("Input device")).toBeNull();
  });

  it("names unnamed inputs by their position", async () => {
    stubRecordingBrowser({ devices: "unnamed" });
    showCheck();
    await screen.findByLabelText("Input device");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Microphone 1",
      "Microphone 2",
    ]);
  });

  it("shows that it is analysing once the recording ends", async () => {
    const browser = stubRecordingBrowser({ holdDecode: true });
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 240000 });
    expect(await screen.findByText("Analyzing...")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start check" })).toBeNull();
    expect(screen.queryByText("Tap a part 2 or 3 times while the check records")).toBeNull();
    await act(async () => browser.releaseDecode());
    expect(await screen.findByText("Good level.")).toBeTruthy();
    expect(screen.queryByText("Analyzing...")).toBeNull();
  });

  it("asks the user to tap and counts down while it records", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    browser.prepare({ samples: fiveSeconds(0.5), seconds: 5, delivered: 240000 });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Start check" }));
    expect(screen.getByText("Tap a part 2 or 3 times while the check records")).toBeTruthy();
    expect(screen.getByText("5.0 s left")).toBeTruthy();
    expect((screen.getByLabelText("Input device") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Start check" })).toBeNull();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("3.0 s left")).toBeTruthy();
  });

  it("finds a healthy input accurate and its tap at a good level", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 239995 });
    expect(
      await screen.findByText("Accurate: frequencies from this input are correct."),
    ).toBeTruthy();
    expect(screen.getByText("Stated 48,000 Hz")).toBeTruthy();
    expect(screen.getByText("Measured 47,999 Hz")).toBeTruthy();
    expect(screen.getByText("0 cents")).toBeTruthy();
    expect(screen.getByText("Good level.")).toBeTruthy();
    expect(screen.getByText("Peak -6.1 dBFS")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/^Noise floor -\d+\.\d dBFS$/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Clock" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Level" })).toBeTruthy();
    expect(screen.queryByText("Tap a part 2 or 3 times while the check records")).toBeNull();
    expect((screen.getByLabelText("Input device") as HTMLSelectElement).disabled).toBe(false);
    browser.prepare({ samples: fiveSeconds(0.5), seconds: 5, delivered: 240000 });
    await userEvent.setup().click(screen.getByRole("button", { name: "Check again" }));
    expect(screen.queryByText(/^Stated/)).toBeNull();
  });

  it("corrects an interface read at 44,100 Hz and remembers it", async () => {
    const browser = stubRecordingBrowser();
    const { unmount, view } = showCheck();
    await runCheck(browser, {
      samples: checkSignal({ length: 220485, tapAmplitude: 0.5 }),
      delivered: 220485,
    });
    expect(
      await screen.findByText(
        "Corrected: this input runs at 44,100 Hz, not the 48,000 Hz the browser reports. The app corrects its recordings automatically. To remove the correction, set the interface to 48 kHz in your computer's audio settings (Audio MIDI Setup on a Mac).",
      ),
    ).toBeTruthy();
    expect(screen.getByText("+147 cents")).toBeTruthy();
    expect(screen.getByText("Measured 44,097 Hz")).toBeTruthy();
    expect(screen.getByText("Last check: Nov 7, 2026. Corrected (44,100 Hz)")).toBeTruthy();
    unmount();
    render(view);
    expect(await screen.findByText("Last check: Nov 7, 2026. Corrected (44,100 Hz)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
  });

  it("remembers the check under the input named once permission is granted", async () => {
    const browser = stubRecordingBrowser({ devices: "hiddenUntilPermission" });
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 240000 });
    expect(await screen.findByText("Last check: Nov 7, 2026. Accurate")).toBeTruthy();
    expect(readCheck(() => localStorage, { id: "default", label: "FastTrack Pro" })).not.toBeNull();
  });

  it("explains a rate it cannot correct", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 210000 });
    expect(
      await screen.findByText(
        "Mismatch: this input does not deliver audio at a rate the app can correct, so its frequencies would be wrong. Set the interface to 48 kHz in your computer's audio settings, or record with another app and load the WAV file.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Last check: Nov 7, 2026. Mismatch")).toBeTruthy();
  });

  it.each([
    ["a clipped tap", 1.5, "Clipping: turn the input gain down or tap more lightly."],
    ["a faint tap", 0.03, "Low: raise the input gain or move the microphone closer."],
    ["no tap", undefined, "No tap heard. Tap a part firmly during the check."],
  ])("gives advice for %s", async (_, tapAmplitude, advice) => {
    const browser = stubRecordingBrowser();
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(tapAmplitude), delivered: 240000 });
    expect(await screen.findByText(advice)).toBeTruthy();
  });

  it("checks the input chosen in the dialog", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    const select = await screen.findByLabelText("Input device");
    await userEvent.setup().selectOptions(select, "builtin");
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 240000 });
    await screen.findByText("Good level.");
    expect(browser.getUserMedia.mock.calls[0]?.[0]).toMatchObject({
      audio: { deviceId: { exact: "builtin" } },
    });
    const storage = () => localStorage;
    expect(readCheck(storage, { id: "builtin", label: "MacBook Pro Microphone" })).not.toBeNull();
    expect(readCheck(storage, { id: "default", label: "FastTrack Pro" })).toBeNull();
    await userEvent.setup().selectOptions(select, "default");
    expect(screen.getByText("Not checked")).toBeTruthy();
    expect(screen.queryByText(/^Stated/)).toBeNull();
  });

  it("says when the microphone cannot be opened, and shows no result", async () => {
    const browser = stubRecordingBrowser();
    browser.getUserMedia.mockRejectedValueOnce(new Error("NotAllowedError"));
    showCheck();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Start check" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Unable to access microphone. Please check permissions.",
    );
    expect(screen.queryByText(/^Stated/)).toBeNull();
    browser.prepare({ samples: fiveSeconds(0.5), seconds: 5, delivered: 240000 });
    await userEvent.setup().click(screen.getByRole("button", { name: "Start check" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the recording cannot be processed", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await runCheck(browser, { samples: new Float32Array(0), delivered: 240000 });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error processing audio. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Start check" })).toBeTruthy();
  });

  it("is in French", async () => {
    const browser = stubRecordingBrowser();
    showCheck("fr");
    expect(screen.getByRole("dialog", { name: "Vérification du micro" })).toBeTruthy();
    await runCheck(browser, {
      samples: checkSignal({ length: 220500, tapAmplitude: 0.5 }),
      delivered: 220500,
    });
    expect(await screen.findByText(/^Mesuré 44\s100 Hz$/)).toBeTruthy();
    expect(screen.getByText("+147 cents")).toBeTruthy();
    expect(screen.getByText(/^Corrigé : cette entrée fonctionne à 44\s100 Hz/)).toBeTruthy();
  });
});

const toneOf = (frequency: number, length = 3 * SAMPLE_RATE, amplitude = 0.3) =>
  Float32Array.from(
    { length },
    (_, n) => amplitude * Math.sin((2 * Math.PI * frequency * n) / SAMPLE_RATE),
  );

const playTone = async (
  browser: ReturnType<typeof stubRecordingBrowser>,
  take: { samples: Float32Array; delivered: number },
  label = "Play test tone",
) => {
  const finish = browser.prepare({ ...take, seconds: 3 });
  await userEvent.setup().click(await screen.findByRole("button", { name: label }));
  finish();
  act(() => vi.advanceTimersByTime(3000));
};

const referenceNote =
  "If the speaker and the microphone are on the same device, a rate error can go unnoticed here. The clock check is the reference.";
const clockReference =
  "The clock check is the reference: recordings from this input are not affected. The speaker's own rate may be off.";

describe("Microphone Check test tone", () => {
  it("plays 440 Hz at half gain for 3 s while it records the input", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    browser.prepare({ samples: toneOf(440), seconds: 3, delivered: 144000 });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Play test tone" }));
    expect(screen.getByText("Playing a 440 Hz tone and listening")).toBeTruthy();
    expect(browser.getUserMedia).toHaveBeenCalledTimes(1);
    expect(browser.tones).toEqual([
      {
        frequency: 440,
        gain: 0.5,
        stopAt: 3,
        started: true,
        toGain: true,
        toSpeakers: true,
        closed: false,
      },
    ]);
    expect(screen.queryByRole("button", { name: "Start check" })).toBeNull();
    act(() => vi.advanceTimersByTime(2900));
    expect(screen.getByText("Playing a 440 Hz tone and listening")).toBeTruthy();
  });

  it("shows the tone it heard and that it matches", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: toneOf(440.2), delivered: 144000 });
    expect(await screen.findByText("Heard 440.2 Hz (+1 cent)")).toBeTruthy();
    expect(screen.getByText("Matches")).toBeTruthy();
    expect(screen.getByText(referenceNote)).toBeTruthy();
    expect(screen.queryByText(/^Corrected from/)).toBeNull();
    expect(screen.queryByText(clockReference)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Playing a 440 Hz tone and listening")).toBeNull();
    expect(screen.getByRole("button", { name: "Play test tone" })).toBeTruthy();
  });

  it("clears the last tone result and stops the previous tone when it plays again", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: toneOf(440.2), delivered: 144000 });
    await screen.findByText("Matches");
    browser.prepare({ samples: toneOf(440), seconds: 3, delivered: 144000 });
    await userEvent.setup().click(screen.getByRole("button", { name: "Play test tone" }));
    expect(screen.queryByText("Matches")).toBeNull();
    expect(browser.tones.map((tone) => tone.closed)).toEqual([true, false]);
  });

  it("stops the tone and the recording when closed", async () => {
    const browser = stubRecordingBrowser();
    const onClose = vi.fn();
    showCheck("en", onClose);
    browser.prepare({ samples: toneOf(440), seconds: 3, delivered: 144000 });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Play test tone" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(browser.tones[0]?.closed).toBe(true);
    expect(browser.track.stop).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText(/^Heard/)).toBeNull();
  });

  it("stops the tone when the dialog goes away", async () => {
    const browser = stubRecordingBrowser();
    const { unmount } = showCheck();
    browser.prepare({ samples: toneOf(440), seconds: 3, delivered: 144000 });
    await userEvent.setup().click(await screen.findByRole("button", { name: "Play test tone" }));
    unmount();
    expect(browser.tones[0]?.closed).toBe(true);
  });

  it("shows the corrected reading of an interface read at 44,100 Hz", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: toneOf((440 * 48000) / 44100, 132300), delivered: 132300 });
    expect(await screen.findByText("Heard 440.0 Hz (0 cents)")).toBeTruthy();
    expect(screen.getByText("Corrected from 478.9 Hz")).toBeTruthy();
    expect(screen.getByText("Matches")).toBeTruthy();
  });

  it("says how far off a tone is, and that the clock is the reference", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: toneOf(452), delivered: 144000 });
    expect(await screen.findByText("Off by +47 cents")).toBeTruthy();
    expect(screen.getByText(clockReference)).toBeTruthy();
  });

  it("leaves out the clock reference when the clock itself is off", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: toneOf(452), delivered: 126000 });
    expect(await screen.findByText("Off by +47 cents")).toBeTruthy();
    expect(screen.queryByText(clockReference)).toBeNull();
    expect(screen.getByText(referenceNote)).toBeTruthy();
  });

  it("says when it did not hear the tone", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: new Float32Array(3 * SAMPLE_RATE), delivered: 144000 });
    expect(
      await screen.findByText(
        "Tone not heard. Turn the volume up or bring the microphone closer to the speaker.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(referenceNote)).toBeTruthy();
    expect(screen.queryByText("Matches")).toBeNull();
  });

  it("keeps the check result next to the tone result", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await runCheck(browser, { samples: fiveSeconds(0.5), delivered: 240000 });
    await screen.findByText("Good level.");
    await playTone(browser, { samples: toneOf(440), delivered: 144000 });
    expect(await screen.findByText("Matches")).toBeTruthy();
    expect(screen.getByText("Good level.")).toBeTruthy();
  });

  it("says when the microphone cannot be opened for the tone", async () => {
    const browser = stubRecordingBrowser();
    browser.getUserMedia.mockRejectedValueOnce(new Error("NotAllowedError"));
    showCheck();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Play test tone" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Unable to access microphone. Please check permissions.",
    );
    expect(browser.tones).toEqual([]);
    browser.prepare({ samples: toneOf(440), seconds: 3, delivered: 144000 });
    await userEvent.setup().click(screen.getByRole("button", { name: "Play test tone" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when the tone recording cannot be processed", async () => {
    const browser = stubRecordingBrowser();
    showCheck();
    await playTone(browser, { samples: new Float32Array(0), delivered: 144000 });
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Error processing audio. Please try again.",
    );
  });

  it("is in French", async () => {
    const browser = stubRecordingBrowser();
    showCheck("fr");
    await playTone(
      browser,
      { samples: toneOf(440.2), delivered: 144000 },
      "Jouer la tonalité de test",
    );
    expect(await screen.findByText(/^Entendu 440,2 Hz \(\+1 cent\)$/)).toBeTruthy();
    expect(screen.getByText("Concorde")).toBeTruthy();
  });
});
