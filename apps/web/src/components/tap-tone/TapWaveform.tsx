"use client";

import type { Tap } from "@gb/dsp";
import { Tooltip } from "@gb/ui";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { waveformColumns } from "@/lib/tap-tone/waveform";

const WIDTH = 640;
const HEIGHT = 96;
const WINDOW_LEAD = 8192;
const WINDOW_SAMPLES = 32768;

export interface TapWaveformProps {
  signal: Float64Array | Float32Array;
  sampleRate: number;
  taps: readonly Tap[];
  /** Numbers of the accepted taps the user excluded. */
  excluded: readonly number[];
  onToggle: (tapNumber: number) => void;
}

/** tap-tone-capture: Waveform With Taps. */
export function TapWaveform({ signal, sampleRate, taps, excluded, onToggle }: TapWaveformProps) {
  const t = useTranslations("tapTone.taps");
  const [announcement, setAnnouncement] = useState("");
  const columns = useMemo(() => waveformColumns(signal, WIDTH), [signal]);
  const seconds = signal.length / sampleRate;
  const used = taps.filter((tap) => tap.rejection === null && !excluded.includes(tap.number));
  const position = (sample: number) => (sample / signal.length) * WIDTH;

  const toggle = (tap: Tap) => {
    if (tap.rejection !== null) return;
    const willExclude = !excluded.includes(tap.number);
    setAnnouncement(t(willExclude ? "excludedNow" : "includedNow", { number: tap.number }));
    onToggle(tap.number);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-24 w-full rounded-xl border border-line bg-inset"
        >
          {taps.map((tap) => (
            <rect
              key={tap.number}
              data-window={tap.number}
              x={position(tap.onset - WINDOW_LEAD)}
              width={position(WINDOW_SAMPLES)}
              y={0}
              height={HEIGHT}
              className={
                tap.rejection === null && !excluded.includes(tap.number)
                  ? "fill-amber-soft"
                  : "fill-raised"
              }
            />
          ))}
          <path
            d={columns
              .map((c, x) => `M${x},${((1 - c.max) / 2) * HEIGHT}V${((1 - c.min) / 2) * HEIGHT}`)
              .join("")}
            className="stroke-amber-ink"
            strokeWidth={1}
          />
        </svg>
        {taps.map((tap) => {
          const rejected = tap.rejection !== null;
          const isUsed = !rejected && !excluded.includes(tap.number);
          const marker = (
            <button
              key={tap.number}
              type="button"
              aria-label={t("tap", { number: tap.number })}
              aria-pressed={rejected ? undefined : isUsed}
              aria-disabled={rejected ? true : undefined}
              onClick={() => toggle(tap)}
              style={{ left: `${(tap.onset / signal.length) * 100}%` }}
              className={`absolute top-1 grid size-7 -translate-x-1/2 place-items-center rounded-full border font-mono text-xs font-bold ${
                isUsed
                  ? "border-amber bg-amber text-on-amber"
                  : rejected
                    ? "border-danger-ink bg-panel text-danger-ink line-through"
                    : "border-line-strong bg-panel text-fg-dim"
              }`}
            >
              {tap.number}
            </button>
          );
          return rejected && tap.rejection ? (
            <Tooltip key={tap.number} content={t(tap.rejection)}>
              {marker}
            </Tooltip>
          ) : (
            marker
          );
        })}
      </div>
      <div className="relative h-4 font-mono text-xs text-fg-dim">
        {Array.from({ length: Math.floor(seconds) + 1 }, (_, i) => i).map((s) => (
          <span
            key={s}
            data-time
            className="absolute -translate-x-1/2"
            style={{ left: `${((s * sampleRate) / signal.length) * 100}%` }}
          >
            {t("seconds", { seconds: s })}
          </span>
        ))}
      </div>
      <p className="text-sm text-fg-dim">{t("count", { used: used.length, total: taps.length })}</p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
