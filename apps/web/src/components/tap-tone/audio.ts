import { applyBiquad, biquadHighPass, encodeWav, wavFileName } from "@gb/dsp";

export const ANALYSIS_SAMPLE_RATE = 48000;

const HIGH_PASS = biquadHighPass({
  sampleRate: ANALYSIS_SAMPLE_RATE,
  cutoff: 30,
  q: 10 ** (1 / 20),
});

const RECORDING_TYPES = [
  "audio/webm;codecs=pcm",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

export type DecodedAudio = {
  readonly channels: readonly Float32Array[];
  readonly sampleRate: number;
};

export type PreparedAudio = {
  readonly filtered: readonly Float64Array[];
  readonly raw: readonly Float32Array[];
  readonly sampleRate: number;
};

export const isSupportedAudioFile = (file: { name: string; type: string }): boolean =>
  /\.(wav|mp3|ogg)$/i.test(file.name) || /wav|mpeg|mp3|ogg/i.test(file.type);

export const pickRecordingType = (isTypeSupported: (type: string) => boolean): string | undefined =>
  RECORDING_TYPES.find((type) => isTypeSupported(type));

export const captureConstraints = (deviceId: string | undefined): MediaStreamConstraints => ({
  audio: {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    channelCount: 1,
    sampleRate: ANALYSIS_SAMPLE_RATE,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
});

export const isMobileDevice = (device: {
  navigator: { userAgent: string; maxTouchPoints: number };
  hasTouchEvents: boolean;
}): boolean =>
  /android|mobile|tablet/i.test(device.navigator.userAgent) ||
  device.navigator.maxTouchPoints > 0 ||
  device.hasTouchEvents;

const mixToMono = (channels: readonly Float32Array[]): Float32Array => {
  const length = channels[0]?.length ?? 0;
  return Float32Array.from(
    { length },
    (_, n) => channels.reduce((total, channel) => total + (channel[n] ?? 0), 0) / channels.length,
  );
};

export const decodeAudio = async (
  bytes: ArrayBuffer,
  options: { mixToMono: boolean },
): Promise<DecodedAudio> => {
  const context = new OfflineAudioContext(1, 1, ANALYSIS_SAMPLE_RATE);
  const buffer = await context.decodeAudioData(bytes);
  if (buffer.length === 0) throw new Error("The audio holds no audio data");
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c),
  );
  return {
    channels: options.mixToMono ? [mixToMono(channels)] : channels,
    sampleRate: buffer.sampleRate,
  };
};

export const prepareAudio = (decoded: DecodedAudio): PreparedAudio => ({
  filtered: decoded.channels.map((channel) => applyBiquad(channel, HIGH_PASS)),
  raw: decoded.channels,
  sampleRate: decoded.sampleRate,
});

export const downloadWav = (
  audio: { channels: readonly (Float32Array | Float64Array)[]; sampleRate: number },
  date: Date,
): void => {
  const bytes = encodeWav(audio.channels, audio.sampleRate);
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = wavFileName(date);
  link.click();
  URL.revokeObjectURL(url);
};
