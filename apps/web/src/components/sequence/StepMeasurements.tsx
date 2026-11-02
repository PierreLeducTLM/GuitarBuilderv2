"use client";

import type { StepMeasurement } from "@gb/db";
import { IconButton } from "@gb/ui";
import { Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useConfirm, usePrompt } from "@/components/DialogProvider";
import type { StepStore } from "@/lib/sequence/store";
import type { StepKey } from "@/lib/sequence/template";
import { SpectrumGraph } from "./SpectrumGraph";

export interface StepMeasurementsProps {
  stepKey: StepKey;
  measurements: StepMeasurement[];
  store: StepStore;
  canEdit: boolean;
}

/**
 * build-sequence: Step Measurement List and Step Measurement Deletion. Recording a new
 * measurement ("Add Analysis") arrives with tap-tone-capture.
 */
export function StepMeasurements({ stepKey, measurements, store, canEdit }: StepMeasurementsProps) {
  const t = useTranslations("sequence.measurement");
  const tDialog = useTranslations("dialog");
  const format = useFormatter();
  const prompt = usePrompt();
  const confirm = useConfirm();

  if (measurements.length === 0) {
    return <p className="text-sm text-fg-dim">{t("empty")}</p>;
  }

  async function editDescription(measurement: StepMeasurement) {
    const description = await prompt({
      title: t("editDescription"),
      inputLabel: t("descriptionLabel"),
      initialValue: measurement.description,
    });
    if (description === null || description === measurement.description) return;
    await store.change(stepKey, {
      op: "set_measurement_description",
      id: measurement.id,
      description,
    });
  }

  async function remove(measurement: StepMeasurement) {
    const confirmed = await confirm({
      title: t("deleteTitle"),
      message: t("deleteMessage"),
      confirmLabel: t("deleteConfirm"),
      cancelLabel: tDialog("cancel"),
      variant: "danger",
    });
    if (confirmed) await store.change(stepKey, { op: "remove_measurement", id: measurement.id });
  }

  return (
    <ul className="flex flex-col gap-4">
      {measurements.map((measurement) => {
        const frequency = format.number(measurement.frequency, "decimal1");
        return (
          <li
            key={measurement.id}
            data-measurement={measurement.id}
            className="flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => editDescription(measurement)}
                    aria-label={t("editLabel", { description: measurement.description })}
                    className="group -mx-1 inline-flex min-h-11 items-center gap-2 self-start rounded-lg px-1 text-left font-semibold break-words text-fg hover:text-amber-ink focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {measurement.description}
                    <Pencil
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-fg-dim group-hover:text-amber-ink"
                    />
                  </button>
                ) : (
                  <span className="font-semibold break-words text-fg">
                    {measurement.description}
                  </span>
                )}
                <span className="text-sm text-fg-dim">
                  {format.dateTime(new Date(measurement.timestamp), "dateTimeShort")}
                </span>
                <span className="font-mono text-sm font-bold text-amber-ink">
                  {t("peak", { frequency })}
                </span>
              </div>
              {canEdit ? (
                <IconButton
                  label={t("delete", { description: measurement.description })}
                  variant="ghost"
                  onClick={() => remove(measurement)}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              ) : null}
            </div>
            <SpectrumGraph
              spectrum={measurement.spectrum}
              peak={measurement.frequency}
              label={t("graphLabel", { description: measurement.description, frequency })}
            />
          </li>
        );
      })}
    </ul>
  );
}
