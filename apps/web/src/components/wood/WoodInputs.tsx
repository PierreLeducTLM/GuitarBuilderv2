"use client";

import { noteLabel } from "@gb/dsp";
import { Button, cx, TextField } from "@gb/ui";
import { CircleAlert, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { SLOT_COLOUR, TAKE_SYMBOL } from "@/components/tap-tone/panels";
import type { PlateTake } from "@/lib/tap-tone/machine";
import {
  type FieldKey,
  formatValue,
  type ValidationErrors,
  type WoodInputStrings,
} from "@/lib/wood/calculator";
import type { CalculatorState } from "@/lib/wood/panel";

const GROUPS = [
  { id: "sample", fields: ["sampleLength", "sampleWidth", "sampleThickness", "sampleMass"] },
  { id: "frequency", fields: ["freqLongitudinal", "freqCrossGrain", "freqDiagonal"] },
  { id: "plate", fields: ["plateLength", "plateWidth"] },
  { id: "stiffness", fields: ["stiffness"] },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

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

/** The takes in the reader's order, each in its colour slot there. */
const TILES = [
  { take: "longitudinal", field: "freqLongitudinal", colour: SLOT_COLOUR[0] },
  { take: "crossGrain", field: "freqCrossGrain", colour: SLOT_COLOUR[1] },
  { take: "diagonal", field: "freqDiagonal", colour: SLOT_COLOUR[2] },
] as const;

const NUMBER_INPUT = {
  type: "number",
  step: "0.1",
  inputMode: "decimal",
} as const;

export interface WoodInputsProps {
  inputs: WoodInputStrings;
  errors: ValidationErrors;
  quality: CalculatorState["quality"];
  onChange: (key: FieldKey, value: string) => void;
  onReset: () => void;
  /** An action beside a group's heading, such as the plate measurement for the frequencies. */
  groupActions?: Partial<Record<GroupId, ReactNode>>;
}

/** One frequency, drawn like the reader's take tile in the same colour, and editable. */
function FrequencyTile({
  take,
  field,
  colour,
  value,
  error,
  qualityLine,
  onChange,
}: {
  take: PlateTake;
  field: (typeof TILES)[number]["field"];
  colour: (typeof SLOT_COLOUR)[number];
  value: string;
  error: string | undefined;
  qualityLine: ReactNode;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const id = useId();
  const frequency = error ? null : Number(value);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div
      data-field={field}
      className={cx(
        "flex min-w-0 flex-col gap-0.5 rounded-xl border bg-panel p-2 sm:p-2.5 transition-[border-color,background-color,box-shadow] duration-150",
        error ? "border-danger-ink" : cx("border-line", colour.editing),
      )}
    >
      <label htmlFor={id} className="flex min-w-0 flex-col items-start gap-0.5">
        <span
          className={cx(
            "max-w-full text-[0.8125rem] font-semibold leading-tight hyphens-auto break-words sm:text-sm",
            colour.ink,
          )}
        >
          {t(`tapTone.takes.name.${take}`)}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-2xs text-fg-faint">
          <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", colour.dot)} />
          <span>
            f<sub>{TAKE_SYMBOL[take]}</sub>
          </span>
        </span>
      </label>
      <span className="mt-0.5 flex items-baseline gap-1">
        <input
          id={id}
          {...NUMBER_INPUT}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${t(`wood.fields.${field}`)} ${UNITS[field]}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${hintId}` : hintId}
          style={{ width: `calc(${Math.max(value.length, 2)}ch + 0.5rem)` }}
          className="-mx-1 min-w-0 max-w-full rounded-md border-b border-dashed border-line-strong bg-transparent px-1 font-mono text-xl font-bold leading-tight tracking-tight text-fg outline-none [appearance:textfield] focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs text-fg-dim">{UNITS[field]}</span>
      </span>
      {frequency !== null ? (
        <span className="font-mono text-xs text-fg-dim">{noteLabel(frequency)}</span>
      ) : null}
      {qualityLine}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-xs text-danger-ink">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      <p id={hintId} className="mt-auto pt-1 text-xs leading-snug text-fg-dim">
        {t(`wood.hints.${field}`)}
      </p>
    </div>
  );
}

/** wood-panel-properties: the ten inputs in their four groups, with validation and reset. */
export function WoodInputs({
  inputs,
  errors,
  quality,
  onChange,
  onReset,
  groupActions = {},
}: WoodInputsProps) {
  const t = useTranslations("wood");
  const locale = useLocale();
  const headingId = useId();
  const q = (value: number | null) =>
    value === null ? t("plate.missing") : formatValue(value, 0, locale);
  const qualityLine = (take: PlateTake) => {
    const measured = quality[take];
    if (!measured) return null;
    return (
      <p className="font-mono text-2xs text-teal-ink">
        {t("plate.quality", { spectral: q(measured.spectralQ), decay: q(measured.decayQ) })}
      </p>
    );
  };
  const errorOf = (key: FieldKey) => {
    const error = errors[key];
    return error ? t(`validation.${error}`) : undefined;
  };
  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map((group) => (
        <fieldset
          key={group.id}
          aria-labelledby={`${headingId}-${group.id}`}
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 id={`${headingId}-${group.id}`} className="text-base font-semibold text-fg">
              {t(`groups.${group.id}`)}
            </h3>
            {groupActions[group.id]}
          </div>
          {group.id === "frequency" ? (
            <div className="grid grid-cols-3 gap-2">
              {TILES.map(({ take, field, colour }) => (
                <FrequencyTile
                  key={take}
                  take={take}
                  field={field}
                  colour={colour}
                  value={inputs[field]}
                  error={errorOf(field)}
                  qualityLine={qualityLine(take)}
                  onChange={(value) => onChange(field, value)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((key) => {
                const unit = UNITS[key];
                return (
                  <TextField
                    key={key}
                    {...NUMBER_INPUT}
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
                    error={errorOf(key)}
                  />
                );
              })}
            </div>
          )}
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
