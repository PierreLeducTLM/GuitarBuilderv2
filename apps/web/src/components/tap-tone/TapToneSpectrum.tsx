"use client";

import type { Peak, SpectrumPoint } from "@gb/dsp";
import { cx } from "@gb/ui";
import { useFormatter, useTranslations } from "next-intl";
import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
  frequencyAtX,
  GRAPH,
  levelY,
  nearestPeakIndex,
  onAxis,
  snapTargetIndex,
  spreadLabels,
  tracePath,
  xOfFrequency,
} from "@/lib/tap-tone/graph";

export type ModeSlot = 1 | 2 | 3;

/** A measured mode drawn as a chip: a body mode in Instrument mode, the active take in Plate mode. */
export type GraphMark = {
  readonly id: string;
  readonly slot: ModeSlot;
  readonly name: string;
  readonly sub?: string;
  readonly frequency: number;
  readonly level: number;
};

type ShownMark = Omit<GraphMark, "level"> & { readonly level: number | null };

export interface TapToneSpectrumProps {
  points: readonly SpectrumPoint[];
  /** Detected peaks, loudest first. */
  peaks: readonly Peak[];
  selected: number | null;
  onSelect: (peakIndex: number) => void;
  marks?: readonly GraphMark[];
  /** The mark the user is looking at; the others are dimmed. */
  focused?: string | null;
  /** Lets the user drag a mark's chip onto another peak. */
  onDragMark?: (id: string, peakIndex: number) => void;
}

const SLOT_COLOUR: Record<ModeSlot, string> = {
  1: "text-mode1",
  2: "text-mode2",
  3: "text-mode3",
};
const SAME_PEAK_HZ = 0.5;
const DIMMED = 0.3;

/** Chip sizes in screen pixels, converted to graph units so chips stay readable on a phone. */
const CHIP = {
  fontPx: 11,
  charPx: 6.6,
  padPx: 8,
  heightPx: 20,
  gapPx: 6,
  bandPx: 38,
  topPx: 6,
} as const;

function useRenderedWidth(ref: RefObject<SVGSVGElement | null>) {
  const [width, setWidth] = useState<number>(GRAPH.width);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** tap-tone-capture: Spectrum Graph Axes, Peak Markers, Hover Readout and Snap, Peak Selection by Click, Mode Labels, Manual Role Assignment. */
export function TapToneSpectrum({
  points,
  peaks,
  selected,
  onSelect,
  marks = [],
  focused = null,
  onDragMark,
}: TapToneSpectrumProps) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const svgRef = useRef<SVGSVGElement>(null);
  const unit = GRAPH.width / useRenderedWidth(svgRef);
  const [pointer, setPointer] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; frequency: number } | null>(null);
  const droppedMark = useRef(false);
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

  const band = Math.round(CHIP.bandPx * unit * 10) / 10;
  const plotBottom = GRAPH.top + GRAPH.plotHeight;
  const shown: readonly ShownMark[] = marks.map((mark) =>
    drag?.id === mark.id ? { ...mark, frequency: drag.frequency, level: null } : mark,
  );
  const chipValue = (frequency: number) => format.number(frequency, "decimal1");
  const chipWidth =
    (Math.max(0, ...shown.map((m) => `${m.name}${m.sub ?? ""} ${chipValue(m.frequency)}`.length)) *
      CHIP.charPx +
      2 * CHIP.padPx) *
    unit;
  const chipCenters = spreadLabels({
    centers: shown.map((m) => xOfFrequency(m.frequency)),
    width: chipWidth,
    gap: CHIP.gapPx * unit,
    min: GRAPH.left,
    max: GRAPH.left + GRAPH.plotWidth,
  });
  const chipTop = -band + CHIP.topPx * unit;
  const chipBottom = chipTop + CHIP.heightPx * unit;
  const isMarked = (frequency: number) =>
    shown.some((m) => Math.abs(m.frequency - frequency) <= SAME_PEAK_HZ);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users select peaks with the Detected Peaks buttons
    <svg
      ref={svgRef}
      role="img"
      aria-label={label}
      viewBox={`0 ${-band} ${GRAPH.width} ${GRAPH.height + band}`}
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
        if (target !== null) onDragMark?.(drag.id, target);
        droppedMark.current = true;
        setDrag(null);
      }}
      onClick={(event) => {
        if (droppedMark.current) {
          droppedMark.current = false;
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
            y2={plotBottom}
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
        strokeOpacity={focused ? 0.6 : 1}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {peaks.map((peak, i) => {
        if (!onAxis(peak.frequency)) return null;
        const state = i === selected ? "selected" : i === 0 ? "strongest" : "other";
        const x = xOfFrequency(peak.frequency);
        const y = levelY(peak.level);
        const colour =
          state === "other" ? "text-fg-dim" : state === "selected" ? "text-fg" : "text-amber-ink";
        const labelled = !isMarked(peak.frequency) && (state === "selected" || snap === i);
        return (
          <g
            key={`${peak.frequency}`}
            data-peak
            data-state={state}
            data-snap={snap === i ? "true" : undefined}
            className={colour}
          >
            {snap === i ? (
              <circle cx={x} cy={y} r={9} fill="none" stroke="currentColor" strokeWidth={1.5} />
            ) : null}
            {state === "selected" ? (
              <circle
                data-ring
                cx={x}
                cy={y}
                r={11.5}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
              />
            ) : null}
            <circle cx={x} cy={y} r={state === "selected" ? 4 : 2.5} fill="currentColor" />
            {labelled ? (
              <text
                x={x}
                y={Math.max(GRAPH.top + 10, y - 15)}
                textAnchor="middle"
                fontSize={11}
                className={
                  state === "selected"
                    ? "fill-current font-mono font-bold"
                    : "fill-current font-mono"
                }
              >
                {hz(peak.frequency)}
              </text>
            ) : null}
          </g>
        );
      })}
      {pointer !== null && snap === null && !drag ? (
        <g data-cursor className="text-fg-dim">
          <line
            x1={xOfFrequency(pointer)}
            x2={xOfFrequency(pointer)}
            y1={GRAPH.top}
            y2={plotBottom}
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
      {shown.map((mark, i) => {
        const x = xOfFrequency(mark.frequency);
        const y = mark.level === null ? null : levelY(mark.level);
        const chipX = chipCenters[i] ?? x;
        const leaderEnd = y === null ? plotBottom : Math.max(GRAPH.top, y - 9);
        return (
          <g
            key={mark.id}
            data-mark={mark.id}
            data-x={x.toFixed(1)}
            className={cx(SLOT_COLOUR[mark.slot], onDragMark && "cursor-grab")}
            opacity={focused && focused !== mark.id ? DIMMED : 1}
            onPointerDown={
              onDragMark ? () => setDrag({ id: mark.id, frequency: mark.frequency }) : undefined
            }
          >
            <polyline
              data-leader
              points={[
                [chipX, chipBottom],
                [chipX, chipBottom + 4 * unit],
                [x, GRAPH.top],
                [x, leaderEnd],
              ]
                .map(([px, py]) => `${px?.toFixed(1)},${py?.toFixed(1)}`)
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={unit}
              strokeDasharray={`${2 * unit} ${3 * unit}`}
            />
            {y === null ? null : (
              <>
                <line
                  x1={x}
                  x2={x}
                  y1={y + 6}
                  y2={plotBottom}
                  stroke="currentColor"
                  strokeOpacity={0.35}
                />
                <circle cx={x} cy={y} r={8} fill="currentColor" fillOpacity={0.18} />
                <circle
                  cx={x}
                  cy={y}
                  r={4}
                  fill="currentColor"
                  className="stroke-ground"
                  strokeWidth={1.5}
                />
              </>
            )}
            <rect
              x={chipX - chipWidth / 2}
              y={chipTop}
              width={chipWidth}
              height={CHIP.heightPx * unit}
              rx={(CHIP.heightPx * unit) / 2}
              className="fill-panel"
              stroke="currentColor"
              strokeWidth={1.2 * unit}
            />
            <text
              x={chipX}
              y={chipTop + (CHIP.heightPx / 2 + CHIP.fontPx * 0.36) * unit}
              textAnchor="middle"
              fontSize={CHIP.fontPx * unit}
              className="font-mono"
            >
              <tspan className="fill-current font-bold">{mark.name}</tspan>
              {mark.sub ? (
                <tspan
                  data-sub
                  className="fill-current font-bold"
                  fontSize={CHIP.fontPx * 0.75 * unit}
                  dy={3 * unit}
                >
                  {mark.sub}
                </tspan>
              ) : null}
              <tspan className="fill-fg" dy={mark.sub ? -3 * unit : undefined}>
                {" "}
                {chipValue(mark.frequency)}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
