"use client";

import { CLIP_LEVEL } from "@gb/dsp";
import { useEffect, useRef } from "react";

const SAMPLES = 2048;

export type WaveformSource = {
  getFloatTimeDomainData: (target: Float32Array<ArrayBuffer>) => void;
};

/** tap-tone-capture: Recording Progress Display. The most recent 2048 input samples. */
export function Oscilloscope({
  analyser,
  onClip,
}: {
  analyser: WaveformSource | null;
  onClip?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!analyser || !element || !context) return;
    const styles = getComputedStyle(element);
    const samples = new Float32Array(SAMPLES);
    let frame = 0;
    const draw = () => {
      analyser.getFloatTimeDomainData(samples);
      if (samples.some((value) => Math.abs(value) >= CLIP_LEVEL)) onClip?.();
      const { width, height } = element;
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1;
      context.strokeStyle = styles.getPropertyValue("--gb-grid");
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();
      context.setLineDash([]);
      context.lineWidth = 1.5;
      context.strokeStyle = styles.getPropertyValue("--gb-amber");
      context.beginPath();
      samples.forEach((value, i) => {
        const x = (i / (SAMPLES - 1)) * width;
        const y = ((1 - value) / 2) * height;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, onClip]);

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a decorative live trace; the canvas never takes focus
    <canvas
      ref={canvas}
      width={640}
      height={120}
      aria-hidden="true"
      className="h-28 w-full rounded-xl border border-line bg-inset"
    />
  );
}
