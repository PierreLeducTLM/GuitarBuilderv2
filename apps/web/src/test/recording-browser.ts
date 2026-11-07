import { vi } from "vitest";

export const SAMPLE_RATE = 48000;

type Track = {
  stop: () => void;
  getSettings: () => { sampleRate: number };
  stats?: { totalFrames: number; deliveredFrames: number };
};

/** Fakes microphone capture: each decode returns the next queued signal, frame counts and the clock are set per recording. */
export const stubRecordingBrowser = (
  options: {
    inputLevel?: number;
    devices?: "named" | "unnamed" | "none" | "hiddenUntilPermission";
    holdDecode?: boolean;
  } = {},
) => {
  const decodes: Float32Array[] = [];
  const held: (() => void)[] = [];
  const track: Track = {
    stop: vi.fn(),
    getSettings: () => ({ sampleRate: SAMPLE_RATE }),
    stats: { totalFrames: 0, deliveredFrames: 0 },
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const permission = { granted: false };
  const getUserMedia = vi.fn(async (_constraints: unknown) => {
    permission.granted = true;
    return stream;
  });
  vi.stubGlobal(
    "OfflineAudioContext",
    class {
      decodeAudioData() {
        const samples = decodes.shift() ?? new Float32Array(0);
        const buffer = {
          numberOfChannels: 1,
          sampleRate: SAMPLE_RATE,
          length: samples.length,
          getChannelData: () => samples,
        };
        if (!options.holdDecode) return Promise.resolve(buffer);
        return new Promise((resolve) => held.push(() => resolve(buffer)));
      }
    },
  );
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent: "Mozilla/5.0 (Macintosh)",
    maxTouchPoints: 0,
    mediaDevices: {
      enumerateDevices: async () => {
        if (options.devices === "hiddenUntilPermission" && !permission.granted) {
          return [{ deviceId: "", kind: "audioinput", label: "" }];
        }
        return options.devices === "none"
          ? []
          : [
              {
                deviceId: "default",
                kind: "audioinput",
                label: options.devices === "unnamed" ? "" : "FastTrack Pro",
              },
              {
                deviceId: "builtin",
                kind: "audioinput",
                label: options.devices === "unnamed" ? "" : "MacBook Pro Microphone",
              },
            ];
      },
      getUserMedia,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    },
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
  type Tone = {
    frequency: number;
    gain: number;
    stopAt: number | null;
    started: boolean;
    toGain: boolean;
    toSpeakers: boolean;
    closed: boolean;
  };
  const tones: Tone[] = [];
  vi.stubGlobal(
    "AudioContext",
    class {
      destination = { kind: "speakers" };
      currentTime = 0;
      tone: Tone | null = null;
      gainNode: unknown = null;
      createOscillator = () => {
        const tone: Tone = {
          frequency: 0,
          gain: 0,
          stopAt: null,
          started: false,
          toGain: false,
          toSpeakers: false,
          closed: false,
        };
        this.tone = tone;
        tones.push(tone);
        return {
          frequency: {
            set value(value: number) {
              tone.frequency = value;
            },
          },
          connect: (target: unknown) => {
            if (target === this.gainNode) tone.toGain = true;
          },
          start: () => {
            tone.started = true;
          },
          stop: (when: number) => {
            tone.stopAt = when;
          },
        };
      };
      createGain = () => {
        const tone = this.tone;
        const node = {
          gain: {
            set value(value: number) {
              if (tone) tone.gain = value;
            },
          },
          connect: (target: unknown) => {
            if (tone && target === this.destination) tone.toSpeakers = true;
          },
        };
        this.gainNode = node;
        return node;
      };
      createAnalyser = () => ({
        fftSize: 0,
        getFloatTimeDomainData: (target: Float32Array) => target.fill(options.inputLevel ?? 0.2),
      });
      createMediaStreamSource = () => ({ connect: vi.fn() });
      close = async () => {
        if (this.tone) this.tone.closed = true;
      };
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
  return {
    decodes,
    tones,
    track,
    getUserMedia,
    releaseDecode: () => held.shift()?.(),
    nextFrame: () => frames.shift()?.(0),
    /** Queues the decoded audio and arms the counters a recording will read at its start and stop. */
    prepare: (take: { samples: Float32Array; seconds: number; delivered: number }) => {
      decodes.push(take.samples);
      clock.mockReturnValue(0);
      track.stats = { totalFrames: 0, deliveredFrames: 0 };
      return () => {
        track.stats = { totalFrames: take.delivered, deliveredFrames: take.delivered };
        clock.mockReturnValue(take.seconds * 1000);
      };
    },
  };
};

/** A recording with one tap of the given peak amplitude a second in, over quiet room noise. */
export const checkSignal = (options: { length: number; tapAmplitude?: number }) =>
  Float32Array.from({ length: options.length }, (_, n) => {
    const noise = 2e-4 * Math.sin(n * 1.7);
    if (options.tapAmplitude === undefined || n < SAMPLE_RATE) return noise;
    const t = (n - SAMPLE_RATE) / SAMPLE_RATE;
    const tap = options.tapAmplitude * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 190 * t);
    return Math.max(-1, Math.min(1, noise + tap));
  });
