"use client";

import { LedProgress, Panel } from "@gb/ui";
import { ArrowRight, CircleCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { latestMeasurement, nextUp, progress, type StepStates } from "@/lib/sequence/state";
import type { DisplayGraph } from "@/lib/sequence/variant";

export interface SummaryStripProps {
  buildId: string;
  graph: DisplayGraph;
  states: StepStates;
}

/** guitar-builds: Build Summary Strip. */
export function SummaryStrip({ buildId, graph, states }: SummaryStripProps) {
  const t = useTranslations();
  const format = useFormatter();
  const figures = progress(graph, states);
  const latest = latestMeasurement(graph, states);
  const next = nextUp(graph, states);
  const progressText = t("builds.summary.progress", {
    completed: figures.completed,
    total: figures.total,
    percent: figures.percent,
  });

  return (
    <Panel className="grid gap-4 md:grid-cols-[2fr_1fr_1.5fr] md:items-center">
      <LedProgress
        value={figures.completed}
        max={figures.total}
        label={t("builds.summary.progressLabel")}
        valueText={progressText}
      />
      <div className="flex flex-col gap-1">
        <span className="text-sm text-fg-dim">{t("builds.summary.latestMeasurement")}</span>
        {latest ? (
          <span className="font-mono text-lg font-bold text-amber-ink">
            {t("builds.summary.measurementValue", {
              frequency: format.number(latest.frequency, "decimal1"),
            })}
          </span>
        ) : (
          <span className="text-fg-dim">{t("builds.summary.noMeasurement")}</span>
        )}
      </div>
      {next ? (
        <Link
          href={`/builds/${buildId}/steps/${next}` as Route}
          className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-amber-ink bg-amber-soft px-3.5 py-2 text-left font-semibold text-fg transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span>{t("builds.summary.nextUp", { step: t(`steps.${next}`) })}</span>
          <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-amber-ink" />
        </Link>
      ) : (
        <span className="flex items-center gap-2 font-semibold text-teal-ink">
          <CircleCheck aria-hidden="true" className="size-5" />
          {t("builds.summary.allDone")}
        </span>
      )}
    </Panel>
  );
}
