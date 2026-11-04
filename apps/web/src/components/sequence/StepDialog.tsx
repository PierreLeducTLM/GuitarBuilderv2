"use client";

import { Button, DialogFrame } from "@gb/ui";
import { Check, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { type StepStates, stepState } from "@/lib/sequence/state";
import type { StepStore } from "@/lib/sequence/store";
import { type StepKey, templateStep } from "@/lib/sequence/template";
import { StepMeasurements } from "./StepMeasurements";
import { StepPhotos } from "./StepPhotos";

export interface StepDialogProps {
  buildId: string;
  stepKey: StepKey | null;
  states: StepStates;
  store: StepStore;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * build-sequence: Step Details Dialog, Step Completion Tracking and Step Notes. Notes
 * save while the user types; the completion toggle saves and closes the dialog.
 */
export function StepDialog({ buildId, stepKey, states, store, canEdit, onClose }: StepDialogProps) {
  const t = useTranslations();
  const notesId = useId();
  if (!stepKey) return null;

  const step = templateStep(stepKey);
  const state = stepState(states, stepKey);
  const label = t(`steps.${stepKey}`);

  function close() {
    store.flushNotes(stepKey ?? undefined);
    onClose();
  }

  function toggleCompleted() {
    if (!stepKey) return;
    void store.change(stepKey, { op: "set_completed", completed: !state.completed });
    close();
  }

  return (
    <DialogFrame
      open
      size="lg"
      onOpenChange={(open) => !open && close()}
      title={
        <span className="flex flex-col gap-1">
          <span className="font-mono text-sm font-bold text-fg-dim">
            {t("sequence.stepNumber", { number: step.number })}
          </span>
          <span className="flex items-center gap-2">
            {label}
            {state.completed ? (
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-teal text-on-teal">
                <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                <span className="sr-only">{t("sequence.completedIcon")}</span>
              </span>
            ) : null}
          </span>
        </span>
      }
      closeLabel={t("dialog.close")}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t("sequence.close")}
          </Button>
          {canEdit ? (
            <Button variant={state.completed ? "secondary" : "primary"} onClick={toggleCompleted}>
              {state.completed ? t("sequence.markIncomplete") : t("sequence.markCompleted")}
            </Button>
          ) : null}
        </>
      }
    >
      <p className="flex items-start gap-2 rounded-xl border border-line bg-inset px-3.5 py-2.5 text-sm text-fg-dim">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info-ink" />
        {t("sequence.hint")}
      </p>

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

      <section aria-labelledby={`${notesId}-photos`} className="flex flex-col gap-2">
        <h3 id={`${notesId}-photos`} className="text-base font-semibold text-fg">
          {t("sequence.photos")}
        </h3>
        <StepPhotos
          buildId={buildId}
          stepKey={stepKey}
          stepLabel={label}
          photos={state.photos}
          store={store}
          canEdit={canEdit}
        />
      </section>

      <section aria-labelledby={`${notesId}-sound`} className="flex flex-col gap-2">
        <h3 id={`${notesId}-sound`} className="text-base font-semibold text-fg">
          {t("sequence.soundAnalysis")}
        </h3>
        <StepMeasurements
          stepKey={stepKey}
          stepLabel={label}
          measurements={state.measurements}
          store={store}
          canEdit={canEdit}
        />
      </section>
    </DialogFrame>
  );
}
