"use client";

import type { StepMeasurement } from "@gb/db";
import { Button, IconButton } from "@gb/ui";
import { AudioLines, Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useConfirm, usePrompt } from "@/components/DialogProvider";
import { type InstrumentConfirm, TapToneDialog } from "@/components/tap-tone/TapToneDialog";
import type { StepStore } from "@/lib/sequence/store";
import type { StepKey } from "@/lib/sequence/template";
import { SpectrumGraph } from "./SpectrumGraph";

const ROLE_ORDER = ["air", "top", "back"] as const;

export interface StepMeasurementsProps {
  stepKey: StepKey;
  /** The step's translated name, for the capture dialog's label. */
  stepLabel: string;
  measurements: StepMeasurement[];
  store: StepStore;
  canEdit: boolean;
}

/**
 * build-sequence: Step Measurement Capture ("Add Analysis", tap-tone-capture in Instrument
 * mode), Step Measurement List and Step Measurement Deletion.
 */
export function StepMeasurements({
  stepKey,
  stepLabel,
  measurements,
  store,
  canEdit,
}: StepMeasurementsProps) {
  const t = useTranslations("sequence.measurement");
  const tRoles = useTranslations("tapTone.roles");
  const tDialog = useTranslations("dialog");
  const format = useFormatter();
  const prompt = usePrompt();
  const confirm = useConfirm();
  const tTapTone = useTranslations("tapTone");
  const [capture, setCapture] = useState(0);

  async function attach(result: InstrumentConfirm) {
    setCapture(0);
    const description = await prompt({
      title: t("descriptionLabel"),
      inputLabel: t("descriptionLabel"),
      initialValue: t("defaultDescription"),
    });
    if (description === null) return;
    const roles = Object.keys(result.roles).length > 0 ? { roles: result.roles } : {};
    await store.change(stepKey, {
      op: "add_measurement",
      measurement: {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description,
        frequency: result.frequency,
        spectrum: {
          ...result.spectrum,
          frequencies: [...result.spectrum.frequencies],
          magnitudes: [...result.spectrum.magnitudes],
          magnitudesDb: [...result.spectrum.magnitudesDb],
        },
        ...roles,
      },
    });
  }

  const addAnalysis = canEdit ? (
    <>
      <Button variant="secondary" onClick={() => setCapture((n) => n + 1)} className="self-start">
        <AudioLines aria-hidden="true" className="size-4" />
        {t("addAnalysis")}
      </Button>
      {capture > 0 ? (
        <TapToneDialog
          key={capture}
          open
          mode="instrument"
          label={tTapTone("stepLabel", { step: stepLabel })}
          onConfirm={(result) => void attach(result)}
          onCancel={() => setCapture(0)}
        />
      ) : null}
    </>
  ) : null;

  if (measurements.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {addAnalysis}
        <p className="text-sm text-fg-dim">{t("empty")}</p>
      </div>
    );
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

  function rolesLine({ roles }: StepMeasurement) {
    const parts = ROLE_ORDER.flatMap((name) => {
      const role = roles?.[name];
      return role
        ? [t("role", { role: tRoles(name), frequency: format.number(role.frequency, "decimal1") })]
        : [];
    });
    return parts.join(" · ");
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
    <div className="flex flex-col gap-3">
      {addAnalysis}
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
                  {rolesLine(measurement) ? (
                    <span data-roles className="font-mono text-sm text-teal-ink">
                      {rolesLine(measurement)}
                    </span>
                  ) : null}
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
    </div>
  );
}
