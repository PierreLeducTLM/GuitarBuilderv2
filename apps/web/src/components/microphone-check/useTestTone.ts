"use client";

import { TEST_TONE_HZ } from "@gb/dsp";
import { useCallback, useEffect, useRef } from "react";

export const TONE_SECONDS = 3;
const TONE_GAIN = 0.5;

/** microphone-check: Test Tone. Plays 440 Hz through the default output for 3 s. */
export function useTestTone() {
  const context = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    void context.current?.close();
    context.current = null;
  }, []);

  const play = useCallback(() => {
    stop();
    const audio = new AudioContext();
    context.current = audio;
    const oscillator = audio.createOscillator();
    oscillator.frequency.value = TEST_TONE_HZ;
    const gain = audio.createGain();
    gain.gain.value = TONE_GAIN;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + TONE_SECONDS);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { play, stop };
}
