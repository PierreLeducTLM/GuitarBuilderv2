"use client";

import type { Peak, SpectrumPoint } from "@gb/dsp";
import { useFormatter, useTranslations } from "next-intl";
import { type PointerEvent, useRef, useState } from "react";
import {
  frequencyAtX,
  GRAPH,
  levelY,
  nearestPeakIndex,
  onAxis,
  snapTargetIndex,
  tracePath,
  xOfFrequency,
} from "@/lib/tap-tone/graph";

export type RoleName = "air" | "top" | "back";

export interface TapToneSpectrumProps {
  points: readonly SpectrumPoint[];
  /** Detected peaks, loudest first. */
  peaks: readonly Peak[];
  selected: number | null;
  onSelect: (peakIndex: number) => void;
  /** Frequencies (Hz) of the body roles to label, Instrument mode only. */
  roles?: Partial<Record<RoleName, number>>;
  onAssignRole?: (role: RoleName, peakIndex: number) => void;
}

const ROLE_ORDER: readonly RoleName[] = ["air", "top", "back"];

/** tap-tone-capture: Spectrum Graph Axes, Peak Markers, Hover Readout and Snap, Peak Selection by Click, Manual Role Assignment. */
export function TapToneSpectrum({
  points,
  peaks,
  selected,
  onSelect,
  roles = {},
  onAssignRole,
}: TapToneSpectrumProps) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const [pointer, setPointer] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ role: RoleName; frequency: number } | null>(null);
  const droppedRole = useRef(false);
  const hz = (frequency: number) =>
    t("spectrum.frequency", { frequency: format.number(frequency, "decimal1") });

  const frequencyOf = (event: PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return frequencyAtX(((event.clientX - box.left) / box.width) * GRAPH.width);
  };

  const snap = drag || pointer === null ? null : snapTargetIndex(peaks, pointer);
  const label =
    peaks.length > 0
      ? t("spectrum.label", { peaks: peaks.map((p) => hz(p.frequency)).join(", ") })
      : t("spectrum.noPeaks");

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users select peaks with the Detected Peaks buttons
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
      className="h-auto w-full touch-none select-none rounded-xl border border-line bg-inset"
      onPointerMove={(event) => {
        const frequency = frequencyOf(event);
        if (drag) setDrag({ ...drag, frequency });
        else setPointer(frequency);
      }}
      onPointerLeave={() => setPointer(null)}
      onPointerUp={(event) => {
        if (!drag) return;
        const target = snapTargetIndex(peaks, frequencyOf(event));
        if (target !== null) onAssignRole?.(drag.role, target);
        droppedRole.current = true;
        setDrag(null);
      }}
      onClick={(event) => {
        if (droppedRole.current) {
          droppedRole.current = false;
          return;
        }
        const frequency = frequencyOf(event);
        const choice = snapTargetIndex(peaks, frequency) ?? nearestPeakIndex(peaks, frequency);
        if (choice !== null) onSelect(choice);
      }}
    >
      <g className="stroke-grid" strokeWidth={1}>
        {GRAPH.gridDb.map((db) => (
          <line
            key={`db${db}`}
            x1={GRAPH.left}
            x2={GRAPH.left + GRAPH.plotWidth}
            y1={levelY(db)}
            y2={levelY(db)}
          />
        ))}
        {GRAPH.gridHz.map((f) => (
          <line
            key={`hz${f}`}
            x1={xOfFrequency(f)}
            x2={xOfFrequency(f)}
            y1={GRAPH.top}
            y2={GRAPH.top + GRAPH.plotHeight}
          />
        ))}
      </g>
      <g className="fill-fg-dim font-mono" fontSize={10}>
        {GRAPH.gridDb.map((db) => (
          <text
            key={`dbl${db}`}
            data-grid="db"
            x={GRAPH.left - 6}
            y={levelY(db) + 3}
            textAnchor="end"
          >
            {format.number(db)}
          </text>
        ))}
        {GRAPH.gridHz.map((f) => (
          <text
            key={`hzl${f}`}
            data-grid="hz"
            x={xOfFrequency(f)}
            y={GRAPH.height - 8}
            textAnchor="middle"
          >
            {format.number(f, { useGrouping: false })}
          </text>
        ))}
      </g>
      <polyline
        points={tracePath(points)}
        fill="none"
        className="stroke-amber-ink"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {peaks.map((peak, i) => {
        if (!onAxis(peak.frequency)) return null;
        const state = i === selected ? "selected" : i === 0 ? "strongest" : "other";
        const x = xOfFrequency(peak.frequency);
        const y = levelY(peak.level);
        return (
          <g
            key={`${peak.frequency}`}
            data-peak
            data-state={state}
            data-snap={snap === i ? "true" : undefined}
            className={
              state === "other"
                ? "text-fg-dim"
                : state === "selected"
                  ? "text-teal-ink"
                  : "text-amber-ink"
            }
          >
            <line
              x1={x}
              x2={x}
              y1={y}
              y2={GRAPH.top + GRAPH.plotHeight}
              stroke="currentColor"
              strokeWidth={state === "selected" ? 2 : 1}
              strokeDasharray={state === "selected" ? undefined : "4 4"}
            />
            {snap === i ? (
              <circle cx={x} cy={y} r={9} fill="none" stroke="currentColor" strokeWidth={1.5} />
            ) : null}
            <circle cx={x} cy={y} r={state === "selected" ? 5 : 3} fill="currentColor" />
            <text
              x={x}
              y={Math.max(GRAPH.top + 10, y - 10)}
              textAnchor="middle"
              fontSize={11}
              className={
                state === "selected" ? "fill-current font-mono font-bold" : "fill-current font-mono"
              }
            >
              {hz(peak.frequency)}
            </text>
          </g>
        );
      })}
      {pointer !== null && snap === null && !drag ? (
        <g data-cursor className="text-fg-dim">
          <line
            x1={xOfFrequency(pointer)}
            x2={xOfFrequency(pointer)}
            y1={GRAPH.top}
            y2={GRAPH.top + GRAPH.plotHeight}
            stroke="currentColor"
            strokeDasharray="2 3"
          />
          <text
            x={xOfFrequency(pointer) + 5}
            y={GRAPH.top + 10}
            fontSize={11}
            className="fill-current font-mono"
          >
            {hz(pointer)}
          </text>
        </g>
      ) : null}
      {ROLE_ORDER.map((role) => {
        const frequency = drag?.role === role ? drag.frequency : roles[role];
        if (frequency === undefined) return null;
        const x = xOfFrequency(frequency);
        return (
          <g
            key={role}
            data-role={role}
            data-x={x.toFixed(1)}
            className="cursor-grab text-teal-ink"
            onPointerDown={() => setDrag({ role, frequency })}
          >
            <rect
              x={x - 22}
              y={GRAPH.top + 16}
              width={44}
              height={18}
              rx={9}
              className="fill-panel"
              stroke="currentColor"
            />
            <text
              x={x}
              y={GRAPH.top + 29}
              textAnchor="middle"
              fontSize={11}
              className="fill-current font-bold"
            >
              {t(`roles.${role}`)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
