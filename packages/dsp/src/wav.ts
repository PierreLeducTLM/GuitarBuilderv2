const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

const toInt16 = (x: number) => {
  const s = Math.min(1, Math.max(-1, x));
  return Math.trunc(s < 0 ? s * 32768 : s * 32767);
};

export const encodeWav = (
  channels: readonly (Float32Array | Float64Array)[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> => {
  const channelCount = channels.length;
  const frames = channels[0]?.length ?? 0;
  const dataBytes = frames * channelCount * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, text: string) =>
    [...text].forEach((char, i) => {
      view.setUint8(offset + i, char.charCodeAt(0));
    });
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * BYTES_PER_SAMPLE, true);
  view.setUint16(32, channelCount * BYTES_PER_SAMPLE, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < frames; frame += 1) {
    channels.forEach((channel, c) => {
      const offset = HEADER_BYTES + (frame * channelCount + c) * BYTES_PER_SAMPLE;
      view.setInt16(offset, toInt16(channel[frame] ?? 0), true);
    });
  }
  return bytes;
};

export const wavFileName = (date: Date): string =>
  `wood-frequency-analysis-${date.toISOString().slice(0, 19).replaceAll(":", "-")}.wav`;
