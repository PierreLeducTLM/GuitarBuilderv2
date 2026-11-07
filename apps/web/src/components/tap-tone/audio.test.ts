// @vitest-environment jsdom
import { measureTone } from "@gb/dsp";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureConstraints,
  correctRate,
  decodeAudio,
  downloadWav,
  isMobileDevice,
  isSupportedAudioFile,
  pickRecordingType,
  prepareAudio,
} from "./audio";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("audio files", () => {
  it.each([
    ["tap.wav", ""],
    ["TAP.MP3", ""],
    ["tap.ogg", ""],
    ["recording", "audio/wav"],
    ["recording", "audio/x-wav"],
    ["recording", "audio/mpeg"],
    ["recording", "audio/mp3"],
    ["recording", "audio/ogg"],
  ])("accepts %s (%s)", (name, type) => {
    expect(isSupportedAudioFile({ name, type })).toBe(true);
  });

  it.each([
    ["tap.flac", "audio/flac"],
    ["notes.txt", "text/plain"],
    ["tap.wav.flac", ""],
  ])("refuses %s (%s)", (name, type) => {
    expect(isSupportedAudioFile({ name, type })).toBe(false);
  });
});

describe("recording format", () => {
  it("prefers lossless PCM in WebM, then Opus, then WebM, then MP4", () => {
    const supported = (types: readonly string[]) => (type: string) => types.includes(type);
    expect(pickRecordingType(supported(["audio/webm;codecs=pcm", "audio/webm"]))).toBe(
      "audio/webm;codecs=pcm",
    );
    expect(pickRecordingType(supported(["audio/mp4", "audio/webm;codecs=opus"]))).toBe(
      "audio/webm;codecs=opus",
    );
    expect(pickRecordingType(supported(["audio/mp4", "audio/webm"]))).toBe("audio/webm");
    expect(pickRecordingType(supported(["audio/mp4"]))).toBe("audio/mp4");
    expect(pickRecordingType(supported([]))).toBeUndefined();
  });

  it("asks for the exact device, one channel at 48 kHz with every processing step off", () => {
    expect(captureConstraints("usb-mic")).toEqual({
      audio: {
        deviceId: { exact: "usb-mic" },
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    expect(captureConstraints(undefined).audio).not.toHaveProperty("deviceId");
  });
});

describe("mobile detection", () => {
  const device = (userAgent: string, maxTouchPoints = 0, touchEvents = false) => ({
    navigator: { userAgent, maxTouchPoints },
    hasTouchEvents: touchEvents,
  });

  it.each([
    "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
    "Mozilla/5.0 (Linux; Tablet; rv:120.0)",
  ])("counts %s as mobile", (userAgent) => {
    expect(isMobileDevice(device(userAgent))).toBe(true);
  });

  it("counts a touch screen as mobile", () => {
    expect(isMobileDevice(device("Mozilla/5.0 (Windows NT 10.0)", 5))).toBe(true);
    expect(isMobileDevice(device("Mozilla/5.0 (Windows NT 10.0)", 0, true))).toBe(true);
  });

  it("counts a desktop without touch as not mobile", () => {
    expect(isMobileDevice(device("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)"))).toBe(false);
  });
});

describe("decoding and preparing audio", () => {
  const stubDecoder = (channels: readonly Float32Array[]) => {
    const contexts: number[] = [];
    class FakeOfflineAudioContext {
      constructor(_channels: number, _length: number, sampleRate: number) {
        contexts.push(sampleRate);
      }
      decodeAudioData() {
        return Promise.resolve({
          numberOfChannels: channels.length,
          sampleRate: 48000,
          length: channels[0]?.length ?? 0,
          getChannelData: (c: number) => channels[c] ?? new Float32Array(0),
        });
      }
    }
    vi.stubGlobal("OfflineAudioContext", FakeOfflineAudioContext);
    return contexts;
  };

  it("decodes at 48 kHz and keeps a recording's channels", async () => {
    const contexts = stubDecoder([Float32Array.of(0.5, 0.5), Float32Array.of(0.1, 0.1)]);
    const decoded = await decodeAudio(new ArrayBuffer(8), { mixToMono: false });
    expect(contexts).toEqual([48000]);
    expect(decoded.sampleRate).toBe(48000);
    expect(decoded.channels).toHaveLength(2);
  });

  it("averages a file's channels into one", async () => {
    stubDecoder([Float32Array.of(0.5, -0.5), Float32Array.of(0.1, 0.3)]);
    const decoded = await decodeAudio(new ArrayBuffer(8), { mixToMono: true });
    expect(decoded.channels).toHaveLength(1);
    expect(Array.from(decoded.channels[0] ?? [])).toEqual([
      expect.closeTo(0.3, 6),
      expect.closeTo(-0.1, 6),
    ]);
  });

  it("refuses audio without samples", async () => {
    stubDecoder([new Float32Array(0)]);
    await expect(decodeAudio(new ArrayBuffer(8), { mixToMono: true })).rejects.toThrow("no audio");
  });

  it("high-pass filters every channel and keeps the raw audio for the clipping test", () => {
    const raw = [
      Float32Array.from({ length: 4800 }, () => 1),
      Float32Array.from({ length: 4800 }, () => 0.5),
    ];
    const prepared = prepareAudio({ channels: raw, sampleRate: 48000 });
    expect(prepared.raw).toBe(raw);
    expect(prepared.filtered).toHaveLength(2);
    expect(Math.abs(prepared.filtered[0]?.[4799] ?? 1)).toBeLessThan(0.01);
    expect(prepared.filtered[1]).toHaveLength(4800);
  });
});

describe("correcting a capture to its true rate", () => {
  const tone = (frequency: number, sampleRate: number, seconds = 3) =>
    Float32Array.from(
      { length: seconds * sampleRate },
      (_, n) => 0.5 * Math.sin((2 * Math.PI * frequency * n) / sampleRate),
    );
  const heard = (channel: Float32Array | undefined) =>
    measureTone({ samples: channel ?? new Float32Array(0), sampleRate: 48000 });

  it("reads a 440 Hz tone from an input at 44,100 Hz labelled 48,000 Hz as 440 Hz", () => {
    const decoded = { channels: [tone(440, 44100)], sampleRate: 48000 };
    const corrected = correctRate(decoded, { statedRate: 48000, trueRate: 44100 });
    expect(corrected.sampleRate).toBe(48000);
    expect(corrected.channels[0]).toHaveLength(144000);
    expect(heard(corrected.channels[0])).toMatchObject({ frequency: expect.closeTo(440, 0) });
  });

  it("corrects every channel", () => {
    const decoded = { channels: [tone(440, 44100), tone(330, 44100)], sampleRate: 48000 };
    const corrected = correctRate(decoded, { statedRate: 48000, trueRate: 44100 });
    expect(heard(corrected.channels[1])).toMatchObject({ frequency: expect.closeTo(330, 0) });
  });

  it("corrects an input that runs faster than the browser states", () => {
    const decoded = { channels: [tone((440 * 44100) / 48000, 48000)], sampleRate: 48000 };
    const corrected = correctRate(decoded, { statedRate: 44100, trueRate: 48000 });
    expect(heard(corrected.channels[0])).toMatchObject({ frequency: expect.closeTo(440, 0) });
  });
});

describe("WAV download", () => {
  it("downloads the filtered audio under the dated file name and releases the URL", () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:tap");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicks: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({ download: this.download, href: this.href });
    });
    downloadWav(
      { channels: [new Float64Array(96000)], sampleRate: 48000 },
      new Date("2026-03-14T15:09:26Z"),
    );
    expect(clicks).toEqual([
      { download: "wood-frequency-analysis-2026-03-14T15-09-26.wav", href: "blob:tap" },
    ]);
    expect(createObjectURL.mock.calls[0]?.[0].size).toBe(44 + 192000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tap");
  });
});
