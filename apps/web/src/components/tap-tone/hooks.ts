"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { captureConstraints, pickRecordingType } from "./audio";

export const MAX_RECORDING_SECONDS = 10;
const TICK_MS = 100;
const ANALYSER_SIZE = 2048;

export type AudioInput = { readonly id: string; readonly label: string | null };

let chosenInput: string | undefined;

export const forgetChosenInput = () => {
  chosenInput = undefined;
};

const listInputs = async (): Promise<readonly AudioInput[]> =>
  (await navigator.mediaDevices.enumerateDevices())
    .filter((device) => device.kind === "audioinput")
    .map((device) => ({ id: device.deviceId, label: device.label || null }));

const initialChoice = (inputs: readonly AudioInput[]) =>
  inputs.find((i) => i.id === chosenInput)?.id ??
  inputs.find((i) => i.id === "default")?.id ??
  inputs[0]?.id;

export function useAudioInputs() {
  const [inputs, setInputs] = useState<readonly AudioInput[]>([]);
  const [selected, setSelected] = useState<string | undefined>(chosenInput);

  const refresh = useCallback(async () => {
    const listed = await listInputs();
    setInputs(listed);
    setSelected(initialChoice(listed));
  }, []);

  useEffect(() => {
    const devices = navigator.mediaDevices;
    void refresh();
    const onChange = () => void refresh();
    devices.addEventListener("devicechange", onChange);
    return () => devices.removeEventListener("devicechange", onChange);
  }, [refresh]);

  const select = useCallback((id: string) => {
    chosenInput = id;
    setSelected(id);
  }, []);

  return { inputs, selected, select, refresh };
}

type Session = {
  readonly stream: MediaStream;
  readonly recorder: MediaRecorder;
  readonly context: AudioContext;
  readonly timer: ReturnType<typeof setInterval>;
  cancelled: boolean;
};

export function useRecorder(options: {
  deviceId: string | undefined;
  onFinished: (recording: Blob) => void;
  onError: (kind: "microphone") => void;
}) {
  const { deviceId, onFinished, onError } = options;
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const session = useRef<Session | null>(null);

  const end = useCallback((cancelled: boolean) => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    current.cancelled = cancelled;
    clearInterval(current.timer);
    current.recorder.stop();
    for (const track of current.stream.getTracks()) track.stop();
    void current.context.close();
    setRecording(false);
    setAnalyser(null);
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices
      .getUserMedia(captureConstraints(deviceId))
      .catch(() => null);
    if (!stream) {
      onError("microphone");
      return;
    }
    const mimeType = pickRecordingType((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks: Blob[] = [];
    const context = new AudioContext();
    const node = context.createAnalyser();
    node.fftSize = ANALYSER_SIZE;
    context.createMediaStreamSource(stream).connect(node);
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      setElapsed(ticks / 10);
      if (ticks >= MAX_RECORDING_SECONDS * 10) end(false);
    }, TICK_MS);
    const current: Session = { stream, recorder, context, timer, cancelled: false };
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      if (!current.cancelled) onFinished(new Blob(chunks, { type: recorder.mimeType }));
    };
    session.current = current;
    setElapsed(0);
    setAnalyser(node);
    setRecording(true);
    recorder.start(TICK_MS);
  }, [deviceId, end, onError, onFinished]);

  const stop = useCallback(() => end(false), [end]);
  const cancel = useCallback(() => end(true), [end]);

  useEffect(() => () => end(true), [end]);

  return { start, stop, cancel, recording, elapsed, analyser };
}

export type Clip = {
  readonly channels: readonly (Float32Array | Float64Array)[];
  readonly sampleRate: number;
};

export function usePlayback() {
  const [playing, setPlaying] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);

  const stop = useCallback(() => {
    source.current?.stop();
    source.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(
    (clip: Clip) => {
      stop();
      context.current ??= new AudioContext();
      const audio = context.current;
      const length = clip.channels[0]?.length ?? 0;
      const buffer = audio.createBuffer(clip.channels.length, length, clip.sampleRate);
      clip.channels.forEach((channel, c) => {
        buffer.copyToChannel(Float32Array.from(channel), c);
      });
      const node = audio.createBufferSource();
      node.buffer = buffer;
      node.connect(audio.destination);
      node.onended = () => {
        if (source.current === node) {
          source.current = null;
          setPlaying(false);
        }
      };
      source.current = node;
      setPlaying(true);
      node.start();
    },
    [stop],
  );

  useEffect(
    () => () => {
      source.current?.stop();
      void context.current?.close();
    },
    [],
  );

  return { play, stop, playing };
}
