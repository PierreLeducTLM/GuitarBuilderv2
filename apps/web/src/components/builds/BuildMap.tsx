"use client";

import { cx } from "@gb/ui";
import { Check } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useId } from "react";
import { SequenceLegend } from "@/components/sequence/SequenceLegend";
import { type GroupState, type GroupSummary, groupGraph } from "@/lib/sequence/map";
import type { StepStates, StepStatus } from "@/lib/sequence/state";
import type { DisplayGraph } from "@/lib/sequence/variant";

export interface BuildMapProps {
  buildId: string;
  graph: DisplayGraph;
  states: StepStates;
}

/** A group's state, named like the step it summarises (build-sequence: Ready Steps). */
const stateName: Record<GroupState, StepStatus> = {
  done: "completed",
  ready: "ready",
  notStarted: "notStarted",
};

const tileStyles: Record<GroupState, string> = {
  done: "border-teal-line bg-teal-soft",
  ready: "border-amber bg-amber-soft shadow-glow-amber",
  notStarted: "border-line bg-panel",
};

function Tile({ buildId, summary }: { buildId: string; summary: GroupSummary }) {
  const t = useTranslations();
  const format = useFormatter();
  const name = t(`groups.${summary.group.messageKey}`);
  const feeds = summary.feeds.map((group) => t(`groups.${group.messageKey}`));
  return (
    <li>
      <Link
        href={`/builds/${buildId}/map/${summary.group.key}` as Route}
        aria-label={t("sequence.map.tile", {
          name,
          completed: summary.completed,
          total: summary.total,
          state: t(`sequence.legend.${stateName[summary.state]}`),
        })}
        className={cx(
          "flex h-full min-h-14 flex-col justify-center gap-1 rounded-xl border px-3 py-2.5 transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          tileStyles[summary.state],
        )}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-sm leading-tight font-semibold text-fg">{name}</span>
          <span className="flex shrink-0 items-center gap-1 font-mono text-xs text-fg-dim">
            {summary.state === "done" ? (
              <Check aria-hidden="true" className="size-3.5 text-teal-ink" strokeWidth={3} />
            ) : null}
            {summary.completed}/{summary.total}
          </span>
        </span>
        {feeds.length > 0 ? (
          <span className="text-xs leading-snug text-fg-dim">
            {t("sequence.map.from", { groups: format.list(feeds) })}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function TileList({
  label,
  buildId,
  groups,
}: {
  label: string;
  buildId: string;
  groups: readonly GroupSummary[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <h2 id={id} className="font-mono text-xs tracking-wider text-fg-faint uppercase">
        {label}
      </h2>
      <ul aria-labelledby={id} className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {groups.map((summary) => (
          <Tile key={summary.group.id} buildId={buildId} summary={summary} />
        ))}
      </ul>
    </div>
  );
}

/**
 * build-sequence: Build Map. The 15 groups as tiles: parts first, then the assembly
 * stages after everything that feeds them. Each tile opens its part flow.
 */
export function BuildMap({ buildId, graph, states }: BuildMapProps) {
  const t = useTranslations("sequence.map");
  const { parts, assembly } = groupGraph(graph, states);
  return (
    <section aria-label={t("label")} className="flex flex-col gap-6">
      <TileList label={t("parts")} buildId={buildId} groups={parts} />
      <TileList label={t("assembly")} buildId={buildId} groups={assembly} />
      <SequenceLegend />
    </section>
  );
}
