"use client";

import { Button, TextField } from "@gb/ui";
import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  type FieldKey,
  formatValue,
  type ValidationErrors,
  type WoodInputStrings,
} from "@/lib/wood/calculator";
import { type CalculatorState, TAKE_FIELDS } from "@/lib/wood/panel";

const GROUPS = [
  { id: "sample", fields: ["sampleLength", "sampleWidth", "sampleThickness", "sampleMass"] },
  { id: "frequency", fields: ["freqLongitudinal", "freqCrossGrain", "freqDiagonal"] },
  { id: "plate", fields: ["plateLength", "plateWidth"] },
  { id: "stiffness", fields: ["stiffness"] },
] as const;

const UNITS: Readonly<Record<FieldKey, string | null>> = {
  sampleLength: "mm",
  sampleWidth: "mm",
  sampleThickness: "mm",
  sampleMass: "g",
  freqLongitudinal: "Hz",
  freqCrossGrain: "Hz",
  freqDiagonal: "Hz",
  plateLength: "mm",
  plateWidth: "mm",
  stiffness: null,
};

const HINTED = [
  "sampleLength",
  "sampleWidth",
  "freqLongitudinal",
  "freqCrossGrain",
  "freqDiagonal",
  "stiffness",
] as const;

const isHinted = (key: FieldKey): key is (typeof HINTED)[number] =>
  HINTED.some((hinted) => hinted === key);

const takeOf = (key: FieldKey) =>
  (["longitudinal", "crossGrain", "diagonal"] as const).find((take) => TAKE_FIELDS[take] === key);

export interface WoodInputsProps {
  inputs: WoodInputStrings;
  errors: ValidationErrors;
  quality: CalculatorState["quality"];
  onChange: (key: FieldKey, value: string) => void;
  onReset: () => void;
  /** Extra content under a group, such as the plate measurement under the frequencies. */
  groupExtras?: Partial<Record<(typeof GROUPS)[number]["id"], ReactNode>>;
}

/** wood-panel-properties: the ten inputs in their four groups, with validation and reset. */
export function WoodInputs({
  inputs,
  errors,
  quality,
  onChange,
  onReset,
  groupExtras = {},
}: WoodInputsProps) {
  const t = useTranslations("wood");
  const locale = useLocale();
  const q = (value: number | null) =>
    value === null ? t("plate.missing") : formatValue(value, 0, locale);
  const qualityLine = (key: FieldKey) => {
    const take = takeOf(key);
    const measured = take ? quality[take] : undefined;
    if (!measured) return null;
    return (
      <p className="font-mono text-sm text-teal-ink">
        {t("plate.quality", { spectral: q(measured.spectralQ), decay: q(measured.decayQ) })}
      </p>
    );
  };
  return (
    <div className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-4">
          <legend className="mb-3 font-mono text-xs font-bold tracking-widest text-fg-dim uppercase">
            {t(`groups.${group.id}`)}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((key) => {
              const unit = UNITS[key];
              const error = errors[key];
              return (
                <div key={key} data-field={key} className="flex flex-col gap-1.5">
                  <TextField
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    mono
                    value={inputs[key]}
                    onChange={(event) => onChange(key, event.target.value)}
                    label={
                      <>
                        {t(`fields.${key}`)}{" "}
                        {unit ? (
                          <span className="ml-1.5 font-mono font-normal text-fg-dim">{unit}</span>
                        ) : null}
                      </>
                    }
                    hint={isHinted(key) ? t(`hints.${key}`) : undefined}
                    error={error ? t(`validation.${error}`) : undefined}
                  />
                  {qualityLine(key)}
                </div>
              );
            })}
          </div>
          {groupExtras[group.id]}
        </fieldset>
      ))}
      <div>
        <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={onReset}>
          {t("reset")}
        </Button>
      </div>
    </div>
  );
}
