import { vi } from "vitest";

export const SAMPLE_RATE = 48000;

type Mode = { frequency: number; amplitude: number; tau: number };

export const synthesize = (seconds: number, onsets: readonly number[], modes: readonly Mode[]) =>
  Float32Array.from({ length: seconds * SAMPLE_RATE }, (_, n) =>
    onsets.reduce(
      (total, onset) => {
        if (n < onset) return total;
        const t = (n - onset) / SAMPLE_RATE;
        return (
          total +
          modes.reduce(
            (sum, m) =>
              sum + m.amplitude * Math.exp(-t / m.tau) * Math.sin(2 * Math.PI * m.frequency * t),
            0,
          )
        );
      },
      2e-4 * Math.sin(n * 1.7),
    ),
  );

export const bodyTaps = () =>
  synthesize(
    5,
    [48000, 105600, 163200],
    [
      { frequency: 98.4, amplitude: 0.25, tau: 0.05 },
      { frequency: 196.9, amplitude: 0.3, tau: 0.06 },
      { frequency: 247.5, amplitude: 0.2, tau: 0.05 },
    ],
  );

/** Fakes the browser audio the tap-tone dialog uses; each decode returns the next queued signal. */
export const stubTapToneBrowser = (decodes: Float32Array[]) => {
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
