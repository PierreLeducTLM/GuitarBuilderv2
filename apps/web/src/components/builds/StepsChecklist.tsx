"use client";

import { cx } from "@gb/ui";
import { Check, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { groupGraph } from "@/lib/sequence/map";
import { type StepStates, type StepStatus, stepStatus } from "@/lib/sequence/state";
import { type StepKey, stepNumberLabel, type TemplateStep } from "@/lib/sequence/template";
import type { DisplayGraph } from "@/lib/sequence/variant";

export interface StepsChecklistProps {
  buildId: string;
  graph: DisplayGraph;
  states: StepStates;
  /** The step shown beside the checklist, if any. */
  currentKey?: StepKey;
}

const markers: Record<StepStatus, string> = {
  completed: "bg-teal text-on-teal",
  ready: "border-2 border-amber bg-amber-soft shadow-glow-amber",
  notStarted: "border border-line-strong",
};

function StepRow({
  buildId,
  step,
  status,
  current,
}: {
  buildId: string;
  step: TemplateStep;
  status: StepStatus;
  current: boolean;
}) {
  const t = useTranslations();
  const number = stepNumberLabel(step.number);
  const label = t(`steps.${step.key}`);
  return (
    <li>
      <Link
        href={`/builds/${buildId}/steps/${step.key}` as Route}
        aria-current={current ? "page" : undefined}
        aria-label={t("sequence.stepName", {
          number,
          label,
          status: t(`sequence.legend.${status}`),
        })}
        className={cx(
          "flex min-h-11 items-center gap-3 rounded-lg px-2 text-[0.9375rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
          current ? "bg-selected" : "hover:bg-raised",
          status === "ready" ? "font-semibold text-fg" : "text-fg-dim",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
            markers[status],
          )}
        >
          {status === "completed" ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span aria-hidden="true" className="w-8 shrink-0 font-mono text-xs text-fg-faint">
          {number}
        </span>
        <span aria-hidden="true" className="min-w-0 flex-1">
          {label}
        </span>
      </Link>
    </li>
  );
}

/**
 * build-sequence: Steps Checklist. What can be done now, then each group as a folding
 * section; groups holding a ready step start unfolded.
 */
export function StepsChecklist({ buildId, graph, states, currentKey }: StepsChecklistProps) {
  const t = useTranslations();
  const id = useId();
  const { parts, assembly } = groupGraph(graph, states);
  const groups = [...parts, ...assembly].sort((left, right) => left.group.id - right.group.id);
  const [open, setOpen] = useState<ReadonlySet<number>>(
    () => new Set(groups.filter((group) => group.state === "ready").map((group) => group.group.id)),
  );
  const status = (key: StepKey) => stepStatus(graph, states, key);
  const ready = graph.steps.filter((step) => status(step.key) === "ready");
  const toggle = (groupId: number) =>
    setOpen((previous) =>
      previous.has(groupId)
        ? new Set([...previous].filter((other) => other !== groupId))
        : new Set([...previous, groupId]),
    );

  return (
    <section aria-label={t("sequence.checklist.label")} className="flex flex-col gap-6">
      {ready.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2
            id={`${id}-ready`}
            className="font-mono text-xs tracking-wider text-fg-faint uppercase"
          >
            {t("sequence.checklist.readyNow")}
          </h2>
          <ul aria-labelledby={`${id}-ready`} className="flex flex-col gap-0.5">
            {ready.map((step) => (
              <StepRow
                key={step.key}
                buildId={buildId}
                step={step}
                status="ready"
                current={step.key === currentKey}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="font-semibold text-teal-ink">{t("builds.summary.allDone")}</p>
      )}

      <div className="flex flex-col border-t border-line">
        {groups.map((summary) => {
          const expanded = open.has(summary.group.id);
          const panelId = `${id}-group-${summary.group.id}`;
          const name = t(`groups.${summary.group.messageKey}`);
          return (
            <div key={summary.group.id} className="border-b border-line">
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={expanded ? panelId : undefined}
                  onClick={() => toggle(summary.group.id)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-lg px-1 text-left font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={cx(
                      "size-4 shrink-0 text-fg-faint transition-transform duration-150",
                      expanded && "rotate-90",
                    )}
                  />
                  <span className="flex-1">{name}</span>
                  <span className="font-mono text-xs font-normal text-fg-dim">
                    {t("sequence.checklist.groupProgress", {
                      completed: summary.completed,
                      total: summary.total,
                    })}
                  </span>
                </button>
              </h3>
              {expanded ? (
                <ul id={panelId} className="flex flex-col gap-0.5 pb-3 pl-1">
                  {summary.steps.map((step) => (
                    <StepRow
                      key={step.key}
                      buildId={buildId}
                      step={step}
                      status={status(step.key)}
                      current={step.key === currentKey}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
