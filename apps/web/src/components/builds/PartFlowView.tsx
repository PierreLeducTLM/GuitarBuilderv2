"use client";

import { cx } from "@gb/ui";
import { ArrowDown, ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { type FlowLink, partFlow } from "@/lib/sequence/flow";
import {
  CONTENT_WIDTH,
  connectorPath,
  flowHeight,
  ROW_GAP,
  ROW_HEIGHT,
} from "@/lib/sequence/flowGeometry";
import { neighbourGroups, type TemplateGroup } from "@/lib/sequence/groups";
import { type StepStates, type StepStatus, stepState, stepStatus } from "@/lib/sequence/state";
import { stepNumberLabel, type TemplateStep } from "@/lib/sequence/template";
import type { DisplayGraph } from "@/lib/sequence/variant";

export interface PartFlowViewProps {
  buildId: string;
  graph: DisplayGraph;
  states: StepStates;
  group: TemplateGroup;
}

const boxStyles: Record<StepStatus, string> = {
  completed: "border-teal-line bg-teal-soft",
  ready: "border-amber bg-amber-soft shadow-glow-amber",
  notStarted: "border-line bg-panel",
};

const highlightStyles = {
  variant: "bg-variant-soft",
  bridgeBlank: "bg-blank-soft",
} as const;

function StepBox({
  buildId,
  group,
  step,
  status,
}: {
  buildId: string;
  group: TemplateGroup;
  step: TemplateStep;
  status: StepStatus;
}) {
  const t = useTranslations();
  const number = stepNumberLabel(step.number);
  const label = t(`steps.${step.key}`);
  return (
    <Link
      href={`/builds/${buildId}/steps/${step.key}?from=${group.key}` as Route}
      draggable={false}
      data-highlight={step.highlight ?? undefined}
      aria-label={t("sequence.stepName", {
        number,
        label,
        status: t(`sequence.legend.${status}`),
      })}
      className={cx(
        "relative flex h-full min-w-0 flex-col justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-[filter] duration-150 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        boxStyles[status],
        step.highlight && status === "notStarted" && highlightStyles[step.highlight],
      )}
    >
      <span
        aria-hidden="true"
        className="flex items-center gap-1.5 font-mono text-2xs font-bold text-fg-dim"
      >
        {number}
        {step.highlight ? (
          <span
            className={cx(
              "size-1.5 rounded-full",
              step.highlight === "variant" ? "bg-variant-ink" : "bg-blank-ink",
            )}
          />
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="line-clamp-2 text-[0.8125rem] leading-tight font-medium text-fg"
      >
        {label}
      </span>
      {status === "completed" ? (
        <span
          aria-hidden="true"
          data-testid="completion-badge"
          className="absolute top-1 right-1 inline-flex size-4 items-center justify-center rounded-full bg-teal text-on-teal"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
    </Link>
  );
}

function LinkList({
  label,
  buildId,
  links,
}: {
  label: string;
  buildId: string;
  links: readonly FlowLink[];
}) {
  const t = useTranslations();
  const id = useId();
  if (links.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={id} className="font-mono text-xs tracking-wider text-fg-faint uppercase">
        {label}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-1.5">
        {links.map((link) => (
          <li key={`${link.step}-${link.other}`}>
            <Link
              href={`/builds/${buildId}/map/${link.otherGroup.key}` as Route}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-fg-dim hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
            >
              <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
              <span>
                {t("sequence.flow.link", {
                  step: t(`steps.${link.other}`),
                  group: t(`groups.${link.otherGroup.messageKey}`),
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * build-sequence: Part Flow. One group's steps, top to bottom at full size, with the
 * connectors between them, the links to and from other groups, and the neighbouring
 * groups. Boxes only open their step (Diagram Interaction Restrictions).
 */
export function PartFlowView({ buildId, graph, states, group }: PartFlowViewProps) {
  const t = useTranslations();
  const flow = partFlow(graph, group.id);
  const widths = flow.rows.map((row) => row.length);
  const height = flowHeight(flow.rows.length);
  const steps = flow.rows.flat();
  const done = steps.filter((step) => stepState(states, step.key).completed).length;
  const { previous, next } = neighbourGroups(group);
  const name = t(`groups.${group.messageKey}`);
  const mapHref = `/builds/${buildId}/map` as Route;

  return (
    <section
      aria-labelledby={`flow-${group.key}`}
      className="mx-auto flex w-full max-w-xl flex-col gap-5"
    >
      <Link
        href={mapHref}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-semibold text-fg-dim hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("builds.views.map")}
      </Link>
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        {previous ? (
          <Link
            href={`/builds/${buildId}/map/${previous.key}` as Route}
            aria-label={t("sequence.flow.previous", { group: t(`groups.${previous.messageKey}`) })}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-fg-dim hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-col items-center text-center">
          <h2 id={`flow-${group.key}`} className="text-xl font-semibold text-fg">
            {name}
          </h2>
          <span className="font-mono text-xs text-fg-dim">
            {t("sequence.flow.progress", { completed: done, total: steps.length })}
          </span>
        </div>
        {next ? (
          <Link
            href={`/builds/${buildId}/map/${next.key}` as Route}
            aria-label={t("sequence.flow.next", { group: t(`groups.${next.messageKey}`) })}
            className="inline-flex size-11 items-center justify-center rounded-xl border border-line text-fg-dim hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        ) : (
          <span />
        )}
      </div>

      <LinkList label={t("sequence.flow.comesFrom")} buildId={buildId} links={flow.entries} />

      <div className="relative" style={{ height }}>
        <svg
          data-connectors
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible text-line-strong"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
        >
          {flow.edges.map((edge) => (
            <path
              key={`${edge.from.key}-${edge.to.key}`}
              d={connectorPath(edge, widths)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <ul
          aria-label={t("sequence.flow.steps", { group: name })}
          className="relative flex flex-col"
          style={{ gap: ROW_GAP, width: `${CONTENT_WIDTH}%` }}
        >
          {flow.rows.map((row) => (
            <li key={row[0]?.key} data-testid="flow-row">
              <ul
                className="grid gap-2"
                style={{
                  height: ROW_HEIGHT,
                  gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                }}
              >
                {row.map((step) => (
                  <li key={step.key} className="min-w-0">
                    <StepBox
                      buildId={buildId}
                      group={group}
                      step={step}
                      status={stepStatus(graph, states, step.key)}
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <LinkList label={t("sequence.flow.leadsTo")} buildId={buildId} links={flow.exits} />
    </section>
  );
}
