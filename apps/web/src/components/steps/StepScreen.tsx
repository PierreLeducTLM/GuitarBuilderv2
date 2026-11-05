"use client";

import { Button, cx, IconButton } from "@gb/ui";
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { StepMeasurements } from "@/components/sequence/StepMeasurements";
import { StepPhotos } from "@/components/sequence/StepPhotos";
import { type GroupKey, groupByKey, groupOf } from "@/lib/sequence/groups";
import {
  type ContextLink,
  nextAfterDone,
  stepContext,
  stepNeighbours,
} from "@/lib/sequence/navigation";
import { type StepStates, stepState } from "@/lib/sequence/state";
import type { StepStore } from "@/lib/sequence/store";
import { type StepKey, templateStep } from "@/lib/sequence/template";
import type { DisplayGraph } from "@/lib/sequence/variant";

export interface StepScreenProps {
  buildId: string;
  stepKey: StepKey;
  graph: DisplayGraph;
  states: StepStates;
  store: StepStore;
  /** False for an administrator viewing another user's build (read-only). */
  canEdit: boolean;
  /** The part flow the step was opened from, if any. */
  from?: GroupKey | null;
  /** Opens another step, or the Steps view for null. */
  onNavigate: (key: StepKey | null) => void;
}

function ContextList({
  label,
  links,
  href,
  completedLabel,
}: {
  label: string;
  links: readonly (ContextLink & { completed?: boolean })[];
  href: (key: StepKey) => string;
  completedLabel: string;
}) {
  const t = useTranslations();
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <h3 id={id} className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
        {label}
      </h3>
      <ul aria-labelledby={id} className="flex flex-col gap-0.5">
        {links.map((link) => {
          const name = t(`steps.${link.key}`);
          return (
            <li key={link.key}>
              <Link
                href={href(link.key) as Route}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm text-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {link.group
                  ? t("sequence.context.inGroup", {
                      step: name,
                      group: t(`groups.${link.group.messageKey}`),
                    })
                  : name}
                {link.completed ? (
                  <span className="inline-flex items-center gap-0.5 text-xs text-teal-ink">
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    {completedLabel}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * build-sequence: Step Screen, Step Context, Step Navigation and Step Completion
 * Tracking. Notes save while typing; leaving the screen saves what is still pending.
 */
export function StepScreen({
  buildId,
  stepKey,
  graph,
  states,
  store,
  canEdit,
  from = null,
  onNavigate,
}: StepScreenProps) {
  const t = useTranslations();
  const notesId = useId();
  const step = templateStep(stepKey);
  const state = stepState(states, stepKey);
  const label = t(`steps.${stepKey}`);
  const group = groupOf(stepKey);
  const context = stepContext(graph, states, stepKey);
  const { previous, next } = stepNeighbours(graph, stepKey);
  const origin = from ? groupByKey(from) : undefined;
  const stepHref = (key: StepKey) =>
    `/builds/${buildId}/steps/${key}${origin ? `?from=${origin.key}` : ""}`;

  useEffect(() => () => store.flushNotes(stepKey), [store, stepKey]);

  function done() {
    void store.change(stepKey, { op: "set_completed", completed: true });
    onNavigate(nextAfterDone(graph, states, stepKey));
  }

  return (
    <article className="flex flex-col gap-5 pb-28 lg:pb-0">
      <Link
        href={(origin ? `/builds/${buildId}/map/${origin.key}` : `/builds/${buildId}`) as Route}
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-semibold text-fg-dim hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {origin ? t(`groups.${origin.messageKey}`) : t("sequence.nav.back")}
      </Link>

      <header className="flex flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-fg-dim">
          <span className="font-mono font-bold">
            {t("sequence.stepNumber", { number: step.number })}
          </span>
          <span>{t(`groups.${group.messageKey}`)}</span>
        </span>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {label}
          {state.completed ? (
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-teal text-on-teal">
              <Check aria-hidden="true" className="size-4" strokeWidth={3} />
              <span className="sr-only">{t("sequence.completedIcon")}</span>
            </span>
          ) : null}
        </h2>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
        {context.starting ? (
          <p className="text-sm text-fg-dim">
            {t("sequence.context.starting", { group: t(`groups.${group.messageKey}`) })}
          </p>
        ) : (
          <ContextList
            label={t("sequence.context.after")}
            links={context.after}
            href={stepHref}
            completedLabel={t("sequence.legend.completed")}
          />
        )}
        {context.last ? (
          <p className="text-sm text-fg-dim">{t("sequence.context.last")}</p>
        ) : (
          <ContextList
            label={t("sequence.context.leadsTo")}
            links={context.leadsTo}
            href={stepHref}
            completedLabel={t("sequence.legend.completed")}
          />
        )}
      </div>

      <section className="flex flex-col gap-2">
        <label htmlFor={notesId} className="text-base font-semibold text-fg">
          {t("sequence.notes")}
        </label>
        <textarea
          id={notesId}
          value={state.notes}
          readOnly={!canEdit}
          placeholder={t("sequence.notesPlaceholder")}
          onChange={(event) => store.setNotes(stepKey, event.target.value)}
          rows={4}
          className="min-h-24 w-full resize-y rounded-xl border border-line bg-panel px-3.5 py-2.5 text-base text-fg outline-none placeholder:text-fg-faint focus:border-amber focus:shadow-[0_0_0_3px_var(--gb-glow-amber)]"
        />
      </section>

      <section aria-label={t("sequence.photos")} className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-fg">{t("sequence.photos")}</h3>
        <StepPhotos
          buildId={buildId}
          stepKey={stepKey}
          stepLabel={label}
          photos={state.photos}
          store={store}
          canEdit={canEdit}
        />
      </section>

      <section aria-label={t("sequence.soundAnalysis")} className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-fg">{t("sequence.soundAnalysis")}</h3>
        <StepMeasurements
          stepKey={stepKey}
          stepLabel={label}
          measurements={state.measurements}
          store={store}
          canEdit={canEdit}
        />
      </section>

      <nav
        aria-label={t("sequence.nav.label")}
        className={cx(
          "fixed inset-x-0 bottom-0 z-20 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 border-t border-line bg-panel px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          "lg:static lg:z-auto lg:rounded-xl lg:border lg:px-3 lg:pb-3",
        )}
      >
        <IconButton
          label={t("sequence.nav.previous")}
          disabled={!previous}
          onClick={() => onNavigate(previous)}
        >
          <ChevronLeft className="size-5" />
        </IconButton>
        {canEdit ? (
          state.completed ? (
            <Button
              variant="secondary"
              onClick={() => void store.change(stepKey, { op: "set_completed", completed: false })}
            >
              {t("sequence.markIncomplete")}
            </Button>
          ) : (
            <Button icon={<Check className="size-4" />} onClick={done}>
              {t("sequence.nav.doneNext")}
            </Button>
          )
        ) : (
          <span />
        )}
        <IconButton
          label={t("sequence.nav.next")}
          disabled={!next}
          onClick={() => onNavigate(next)}
        >
          <ChevronRight className="size-5" />
        </IconButton>
      </nav>
    </article>
  );
}
