"use client";

/**
 * THROWAWAY device-test instrument for openspec change tap-tone-capture-rate-check (task 1.1).
 * Shown only with ?captureDiagnostics=1. Never merged: task 5.1 deletes this file.
 */

import { realSpectrum } from "@gb/dsp";
import { Button } from "@gb/ui";
import { useRef, useState } from "react";
import { decodeAudio, downloadWav, pickRecordingType } from "./audio";

type RateRequest = "48000" | "44100" | "none";

const STAT_KEYS = [
  "totalFrames",
  "deliveredFrames",
  "totalFramesDuration",
  "deliveredFramesDuration",
  "latency",
  "averageLatency",
] as const;

type StatSnapshot = Partial<Record<(typeof STAT_KEYS)[number], number>>;

const readStats = (track: MediaStreamTrack): StatSnapshot | null => {
  const stats: unknown = Reflect.get(track, "stats");
  if (typeof stats !== "object" || stats === null) return null;
  return Object.fromEntries(
    STAT_KEYS.flatMap((key) => {
      const value: unknown = Reflect.get(stats, key);
      return typeof value === "number" ? [[key, value]] : [];
    }),
  );
};

const statDelta = (start: StatSnapshot | null, end: StatSnapshot | null) =>
  start && end
    ? Object.fromEntries(
        STAT_KEYS.flatMap((key) => {
          const a = start[key];
          const b = end[key];
          return a !== undefined && b !== undefined ? [[key, b - a]] : [];
        }),
      )
    : null;

const N = 32768;

const dominantTone = (signal: Float32Array, sampleRate: number) => {
  const start = Math.max(0, Math.floor((signal.length - N) / 2));
  const frame = Float64Array.from(
    { length: N },
    (_, n) => (signal[start + n] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1))),
  );
  const { re, im } = realSpectrum(frame);
  const power = re.map((x, k) => x * x + (im[k] ?? 0) ** 2);
  const df = sampleRate / N;
  const lo = Math.ceil(30 / df);
  const hi = Math.min(power.length - 2, Math.floor(5000 / df));
  let best = lo;
  for (let k = lo; k <= hi; k++) if ((power[k] ?? 0) > (power[best] ?? 0)) best = k;
  const db = (k: number) => 10 * Math.log10((power[k] ?? 0) + 1e-30);
  const a = db(best - 1);
  const b = db(best);
  const c = db(best + 1);
  const offset = (0.5 * (a - c)) / (a - 2 * b + c);
  let near = 0;
  let total = 0;
  for (let k = lo; k < power.length; k++) {
    total += power[k] ?? 0;
    if (Math.abs(k - best) * df <= 10) near += power[k] ?? 0;
  }
  return {
    frequency: (best + offset) * df,
    spurDb: 10 * Math.log10(Math.max(total - near, 1e-30) / Math.max(near, 1e-30)),
  };
};

const stuckRuns = (signal: Float32Array, minRun: number) => {
  let zeros = 0;
  let repeats = 0;
  let run = 1;
  for (let n = 1; n <= signal.length; n++) {
    if (n < signal.length && signal[n] === signal[n - 1]) {
      run += 1;
      continue;
    }
    if (run >= minRun) {
      if (signal[n - 1] === 0) zeros += 1;
      else repeats += 1;
    }
    run = 1;
  }
  return { zeros, repeats };
};

const constraintsFor = (
  deviceId: string | undefined,
  rate: RateRequest,
): MediaStreamConstraints => ({
  audio: {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    channelCount: 1,
    ...(rate === "none" ? {} : { sampleRate: Number(rate) }),
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
});

type Live = {
  stream: MediaStream;
  recorder: MediaRecorder;
  context: AudioContext;
  header: Record<string, unknown>;
  statsAtStart: StatSnapshot | null;
  startedAt: number;
};

export function CaptureDiagnostics({ deviceId }: { deviceId: string | undefined }) {
  const [rate, setRate] = useState<RateRequest>("48000");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<readonly string[]>([]);
  const [lastRaw, setLastRaw] = useState<{ channels: Float32Array[]; sampleRate: number } | null>(
    null,
  );
  const live = useRef<Live | null>(null);

  const append = (entry: string) => setLog((previous) => [entry, ...previous]);

  const start = async () => {
    const stream = await navigator.mediaDevices
      .getUserMedia(constraintsFor(deviceId, rate))
      .catch((error: unknown) => {
        append(`getUserMedia failed: ${String(error)}`);
        return null;
      });
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const context = new AudioContext();
    context.createMediaStreamSource(stream);
    const mimeType = pickRecordingType((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks: Blob[] = [];
    const header: Record<string, unknown> = {
      label: label || "(no label)",
      request: rate,
      userAgent: navigator.userAgent,
      trackLabel: track.label,
      settings: track.getSettings(),
      capabilitySampleRate: track.getCapabilities?.().sampleRate ?? null,
      contextSampleRate: context.sampleRate,
      contextBaseLatency: context.baseLatency,
      mimeType: recorder.mimeType || mimeType || "(default)",
    };
    const current: Live = {
      stream,
      recorder,
      context,
      header,
      statsAtStart: null,
      startedAt: 0,
    };
    recorder.onstart = () => {
      current.startedAt = performance.now();
      current.statsAtStart = readStats(track);
    };
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const elapsed = (performance.now() - current.startedAt) / 1000;
      const statsAtStop = readStats(track);
      for (const t of stream.getTracks()) t.stop();
      void context.close();
      void (async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const decoded = await decodeAudio(await blob.arrayBuffer(), { mixToMono: true }).catch(
          (error: unknown) => {
            append(`decode failed: ${String(error)}`);
            return null;
          },
        );
        setBusy(false);
        if (!decoded) return;
        const signal = decoded.channels[0] ?? new Float32Array(0);
        const decodedSeconds = signal.length / decoded.sampleRate;
        const tone = dominantTone(signal, decoded.sampleRate);
        const delta = statDelta(current.statsAtStart, statsAtStop);
        const statedRate = Number(current.header.contextSampleRate) || 48000;
        const framesRate = delta?.totalFrames !== undefined ? delta.totalFrames / elapsed : null;
        let peakAbs = 0;
        for (const x of signal) peakAbs = Math.max(peakAbs, Math.abs(x));
        setLastRaw({ channels: [Float32Array.from(signal)], sampleRate: decoded.sampleRate });
        append(
          JSON.stringify(
            {
              ...current.header,
              elapsedSeconds: Number(elapsed.toFixed(3)),
              decodedSeconds: Number(decodedSeconds.toFixed(3)),
              durationRatio: Number((decodedSeconds / elapsed).toFixed(4)),
              blobBytes: blob.size,
              chunks: chunks.length,
              statsAtStart: current.statsAtStart,
              statsAtStop,
              statsDelta: delta,
              framesPerSecond: framesRate === null ? null : Math.round(framesRate),
              framesRatio:
                framesRate === null ? null : Number((framesRate / statedRate).toFixed(4)),
              droppedFraction:
                delta?.totalFrames && delta.deliveredFrames !== undefined
                  ? Number((1 - delta.deliveredFrames / delta.totalFrames).toFixed(5))
                  : null,
              toneHz: Number(tone.frequency.toFixed(2)),
              toneRatioTo440: Number((tone.frequency / 440).toFixed(4)),
              spurDb: Number(tone.spurDb.toFixed(1)),
              peakAbs: Number(peakAbs.toFixed(4)),
              stuckRuns16: stuckRuns(signal, 16),
            },
            null,
            1,
          ),
        );
      })();
    };
    live.current = current;
    setBusy(true);
    recorder.start(100);
  };

  const stop = () => {
    const current = live.current;
    live.current = null;
    current?.recorder.stop();
  };

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line-strong p-3 text-sm text-fg">
      <h3 className="font-semibold">Capture diagnostics (temporary)</h3>
      <p className="text-fg-dim">
        Play a steady 440 Hz tone near the microphone, record 5 s, then press Copy and paste the
        result back.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          Rate request
          <select
            value={rate}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "48000" || value === "44100" || value === "none") setRate(value);
            }}
            className="rounded-lg border border-line bg-inset px-2 py-1"
          >
            <option value="48000">48000</option>
            <option value="44100">44100</option>
            <option value="none">none</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          Setup
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Pixel + Fast Track"
            className="rounded-lg border border-line bg-inset px-2 py-1"
          />
        </label>
        {busy ? (
          <Button variant="danger" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void start()}>
            Record
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => void navigator.clipboard.writeText(log.join("\n\n"))}
        >
          Copy all
        </Button>
        {lastRaw ? (
          <Button variant="secondary" onClick={() => downloadWav(lastRaw, new Date())}>
            Download last (unfiltered)
          </Button>
        ) : null}
      </div>
      {log.map((entry, i) => (
        <pre
          // biome-ignore lint/suspicious/noArrayIndexKey: throwaway log, append-only
          key={log.length - i}
          className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-inset p-2 font-mono text-xs"
        >
          {entry}
        </pre>
      ))}
    </section>
  );
}
