"use client";

import type { SpectrumRecord } from "@gb/db";
import { useFormatter, useTranslations } from "next-intl";
import {
  SPECTRUM_GRID_DB,
  SPECTRUM_GRID_HZ,
  SPECTRUM_MAX_HZ,
  SPECTRUM_MIN_HZ,
  spectrumPoints,
  spectrumX,
  spectrumY,
} from "@/lib/sequence/spectrum";

const WIDTH = 600;
const HEIGHT = 220;
const LEFT = 44;
const RIGHT = 14;
const TOP = 10;
const BOTTOM = 24;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export interface SpectrumGraphProps {
  spectrum: SpectrumRecord;
  /** Accepted peak frequency, Hz. */
  peak: number;
  /** Accessible description of the graph. */
  label: string;
}

/**
 * build-sequence: Spectrum Graph. Linear 20-2000 Hz across, -100 to 0 dB up, labelled
 * grid lines every 20 dB and at 100, 250, 500, 750, 1000, 1500 and 2000 Hz, and a dashed
 * marker at the peak.
 */
export function SpectrumGraph({ spectrum, peak, label }: SpectrumGraphProps) {
  const t = useTranslations("sequence.measurement");
  const format = useFormatter();
  const px = (fraction: number) => LEFT + fraction * PLOT_WIDTH;
  const py = (fraction: number) => TOP + fraction * PLOT_HEIGHT;
  const points = spectrumPoints(spectrum)
    .map((point) => `${px(point.x).toFixed(1)},${py(point.y).toFixed(1)}`)
    .join(" ");
  const peakVisible = peak >= SPECTRUM_MIN_HZ && peak <= SPECTRUM_MAX_HZ;
  const peakX = px(spectrumX(peak));

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full rounded-xl border border-line bg-inset"
    >
      <g className="stroke-grid" strokeWidth={1}>
        {SPECTRUM_GRID_DB.map((db) => (
          <line
            key={`db${db}`}
            x1={LEFT}
            x2={WIDTH - RIGHT}
            y1={py(spectrumY(db))}
            y2={py(spectrumY(db))}
          />
        ))}
        {SPECTRUM_GRID_HZ.map((hz) => (
          <line
            key={`hz${hz}`}
            x1={px(spectrumX(hz))}
            x2={px(spectrumX(hz))}
            y1={TOP}
            y2={TOP + PLOT_HEIGHT}
          />
        ))}
      </g>
      <g className="fill-fg-dim font-mono" fontSize={10}>
        {SPECTRUM_GRID_DB.map((db) => (
          <text
            key={`dbl${db}`}
            data-grid="db"
            x={LEFT - 6}
            y={py(spectrumY(db)) + 3}
            textAnchor="end"
          >
            {format.number(db)}
          </text>
        ))}
        {SPECTRUM_GRID_HZ.map((hz) => (
          <text
            key={`hzl${hz}`}
            data-grid="hz"
            x={px(spectrumX(hz))}
            y={HEIGHT - 8}
            textAnchor="middle"
          >
            {format.number(hz, { useGrouping: false })}
          </text>
        ))}
      </g>
      <title>{label}</title>
      {points ? (
        <polyline
          data-testid="spectrum-trace"
          points={points}
          fill="none"
          className="stroke-amber-ink"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : null}
      {peakVisible ? (
        <g data-testid="peak-marker">
          <line
            x1={peakX}
            x2={peakX}
            y1={TOP}
            y2={TOP + PLOT_HEIGHT}
            className="stroke-teal-ink"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={peakX + 5}
            y={TOP + 12}
            className="fill-teal-ink font-mono font-bold"
            fontSize={11}
            textAnchor={peak > 1700 ? "end" : "start"}
            dx={peak > 1700 ? -10 : 0}
          >
            {t("peakMarker", { frequency: format.number(peak, "decimal1") })}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
