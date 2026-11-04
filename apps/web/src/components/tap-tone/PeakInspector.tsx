"use client";

import type { DecaySeries, PeakDecay, SeriesPoint, Tap } from "@gb/dsp";
import { Button } from "@gb/ui";
import { useFormatter, useTranslations } from "next-intl";

const WIDTH = 640;
const HEIGHT = 200;
const PAD = 8;

const path = (points: readonly SeriesPoint[], x: (t: number) => number, y: (v: number) => number) =>
  points.map((p) => `${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");

function RingDown({ series, label }: { series: DecaySeries; label: string }) {
  const t = useTranslations("tapTone.inspector");
  const all = [...series.response, ...series.envelope];
  const duration = Math.max(1e-3, ...all.map((p) => p.time));
  const peak = Math.max(1e-9, ...all.map((p) => Math.abs(p.value)));
  const x = (time: number) => PAD + (time / duration) * (WIDTH - 2 * PAD);
  const y = (value: number) => HEIGHT / 2 - (value / peak) * (HEIGHT / 2 - PAD);
  const { start, end, noise, threshold } = series.markers;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full rounded-xl border border-line bg-inset"
    >
      <title>{label}</title>
      {start !== null ? (
        <rect
          x={PAD}
          y={0}
          width={Math.max(0, x(start) - PAD)}
          height={HEIGHT}
          className="fill-raised"
        >
          <title>{t("excluded")}</title>
        </rect>
      ) : null}
      <polyline
        data-series="response"
        points={path(series.response, x, y)}
        fill="none"
        className="stroke-fg-faint"
        strokeWidth={1}
      />
      <polyline
        data-series="envelope"
        points={path(series.envelope, x, y)}
        fill="none"
        className="stroke-amber-ink"
        strokeWidth={1.5}
      />
      <polyline
        data-series="fit"
        points={path(series.fit, x, y)}
        fill="none"
        className="stroke-teal-ink"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
      {start !== null ? (
        <line
          data-marker="start"
          x1={x(start)}
          x2={x(start)}
          y1={0}
          y2={HEIGHT}
          className="stroke-teal-line"
        />
      ) : null}
      {end !== null ? (
        <line
          data-marker="end"
          x1={x(end)}
          x2={x(end)}
          y1={0}
          y2={HEIGHT}
          className="stroke-teal-line"
        >
          <title>{t("fitEnds")}</title>
        </line>
      ) : null}
      <line
        data-marker="noise"
        x1={PAD}
        x2={WIDTH - PAD}
        y1={y(noise)}
        y2={y(noise)}
        className="stroke-grid"
        strokeDasharray="2 3"
      >
        <title>{t("noise")}</title>
      </line>
      <line
        data-marker="threshold"
        x1={PAD}
        x2={WIDTH - PAD}
        y1={y(threshold)}
        y2={y(threshold)}
        className="stroke-line-strong"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/** tap-tone-capture: Peak Inspector Decay View. */
export function PeakInspector({
  frequency,
  decay,
  series,
  taps,
  chosenTap,
  onChooseTap,
}: {
  frequency: number;
  decay: PeakDecay | "pending";
  series: DecaySeries | null;
  taps: readonly Tap[];
  chosenTap: number | null;
  onChooseTap: (tapNumber: number) => void;
}) {
  const t = useTranslations("tapTone");
  const format = useFormatter();
  const one = (value: number) => format.number(value, "decimal1");
  if (decay === "pending") {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg-dim">{t("inspector.heading")}</h3>
        <p className="text-sm text-fg-dim">{t("detected.pending")}</p>
      </section>
    );
  }
  const numberOf = (onset: number) => taps.find((tap) => tap.onset === onset)?.number ?? 0;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg-dim">{t("inspector.heading")}</h3>
      {decay.reason === null ? (
        <p className="font-mono text-sm font-bold text-fg">
          {t("inspector.summary", {
            q: format.number(Math.round(decay.q)),
            valid: decay.valid,
            used: decay.used,
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-fg">{t(`qReasons.${decay.reason}`)}</p>
          {decay.reason === "MODE_NOT_ISOLATED" && decay.isolation.neighbour !== null ? (
            <p className="font-mono text-fg-dim">
              {t("inspector.notIsolated", {
                neighbour: one(decay.isolation.neighbour),
                spacing: one(decay.isolation.spacing),
              })}
            </p>
          ) : (
            <p className="text-fg-dim">
              {t("inspector.refused", { valid: decay.valid, used: decay.used })}
            </p>
          )}
        </div>
      )}
      {decay.taps.length > 0 ? (
        <>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">{t("inspector.tapsLabel")}</legend>
            {decay.taps.map((tap) => {
              const number = numberOf(tap.onset);
              return (
                <Button
                  key={tap.onset}
                  variant={number === chosenTap ? "primary" : "secondary"}
                  aria-pressed={number === chosenTap}
                  onClick={() => onChooseTap(number)}
                >
                  {t("taps.tap", { number })}
                </Button>
              );
            })}
          </fieldset>
          {series && chosenTap !== null ? (
            <RingDown
              series={series}
              label={t("inspector.graphLabel", { number: chosenTap, frequency: one(frequency) })}
            />
          ) : null}
          <table className="w-full text-left text-sm">
            <thead className="text-fg-dim">
              <tr>
                <th className="py-1 font-semibold">{t("inspector.tap")}</th>
                <th className="py-1 font-semibold">{t("inspector.decayQ")}</th>
                <th className="py-1 font-semibold">{t("inspector.tau")}</th>
                <th className="py-1 font-semibold">{t("inspector.range")}</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {decay.taps.map((tap) => (
                <tr key={tap.onset}>
                  <td className="py-1">{numberOf(tap.onset)}</td>
                  <td className="py-1">
                    {tap.q === null
                      ? t(`qReasons.${tap.reason}`)
                      : format.number(Math.round(tap.q))}
                  </td>
                  <td className="py-1">
                    {tap.tau === null
                      ? "—"
                      : t("inspector.ms", { ms: format.number(Math.round(tap.tau * 1000)) })}
                  </td>
                  <td className="py-1">
                    {tap.fit ? t("inspector.db", { db: one(tap.fit.range) }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}
