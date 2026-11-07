"use client";

import type { StepMeasurement } from "@gb/db";
import { CircleCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { SpectrumGraph } from "@/components/sequence/SpectrumGraph";
import type { TimelineStep } from "@/lib/story/story";
import { StoryPhotos } from "./StoryPhotos";

/**
 * build-story-sharing: Story Step Card. The completed check, the step's name and timeline
 * number, then whichever of its notes, photos and sound analysis it has.
 */
export function StoryStepCard({ step }: { step: TimelineStep }) {
  const t = useTranslations();
  const label = t(`steps.${step.key}`);
  const { notes, photos, measurements } = step.state;
  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <CircleCheck
          role="img"
          aria-label={t("sequence.completedIcon")}
          className="mt-0.5 size-6 shrink-0 text-teal"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-lg font-semibold text-fg">{label}</h3>
          <span className="font-mono text-xs tracking-wider text-fg-dim uppercase">
            {t("story.stepNumber", { number: step.number })}
          </span>
        </div>
      </div>
      {notes.trim() !== "" ? (
        <CardSection title={t("sequence.notes")}>
          <p className="whitespace-pre-line text-fg">{notes}</p>
        </CardSection>
      ) : null}
      {photos.length > 0 ? (
        <CardSection title={t("story.photoCount", { count: photos.length })}>
          <StoryPhotos photos={photos} stepLabel={label} />
        </CardSection>
      ) : null}
      {measurements.length > 0 ? (
        <CardSection title={t("story.soundAnalysis", { count: measurements.length })}>
          <ul className="flex flex-col gap-4">
            {measurements.map((measurement) => (
              <li key={measurement.id}>
                <StoryMeasurement measurement={measurement} />
              </li>
            ))}
          </ul>
        </CardSection>
      ) : null}
    </article>
  );
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h4 id={id} className="text-sm font-semibold tracking-wide text-fg-dim">
        {title}
      </h4>
      {children}
    </section>
  );
}

function StoryMeasurement({ measurement }: { measurement: StepMeasurement }) {
  const t = useTranslations("sequence.measurement");
  const format = useFormatter();
  const frequency = format.number(measurement.frequency, "decimal1");
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-inset p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-semibold text-fg">{measurement.description}</span>
        <span className="font-mono text-sm text-amber-ink">{t("peak", { frequency })}</span>
      </div>
      <span className="font-mono text-xs text-fg-dim">
        {format.dateTime(new Date(measurement.timestamp), "dateTimeShort")}
      </span>
      <SpectrumGraph
        spectrum={measurement.spectrum}
        peak={measurement.frequency}
        label={t("graphLabel", { description: measurement.description, frequency })}
      />
    </div>
  );
}
