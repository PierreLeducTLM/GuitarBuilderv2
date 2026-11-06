"use client";

import { noteLabel } from "@gb/dsp";
import { Button, cx } from "@gb/ui";
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

type FrequencyKey = "freqLongitudinal" | "freqCrossGrain" | "freqDiagonal";
type MeasurementKey = Exclude<FieldKey, FrequencyKey>;

const GROUPS = [
  {
    id: "sample",
    grid: "grid-cols-2 sm:grid-cols-4",
    fields: ["sampleLength", "sampleWidth", "sampleThickness", "sampleMass"],
  },
  { id: "frequency", grid: "grid-cols-3", fields: [] },
  { id: "plate", grid: "grid-cols-3", fields: ["plateLength", "plateWidth"] },
  { id: "stiffness", grid: "grid-cols-3", fields: ["stiffness"] },
] as const satisfies readonly {
  id: string;
  grid: string;
  fields: readonly MeasurementKey[];
}[];

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

const SYMBOLS: Readonly<Record<MeasurementKey, string>> = {
  sampleLength: "L",
  sampleWidth: "W",
  sampleThickness: "h",
  sampleMass: "m",
  plateLength: "a",
  plateWidth: "b",
  stiffness: "f",
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
const FREQUENCIES = [
  { take: "longitudinal", field: "freqLongitudinal", colour: SLOT_COLOUR[0] },
  { take: "crossGrain", field: "freqCrossGrain", colour: SLOT_COLOUR[1] },
  { take: "diagonal", field: "freqDiagonal", colour: SLOT_COLOUR[2] },
] as const satisfies readonly { take: PlateTake; field: FrequencyKey; colour: unknown }[];

/** The other measurements: the same tile, uncoloured, with the app's amber focus. */
const NEUTRAL = {
  ink: "text-fg",
  dot: null,
  editing: "focus-within:border-amber focus-within:shadow-[0_0_0_1px_var(--gb-amber)]",
} as const;

type TileColour = { ink: string; dot: string | null; editing: string };

export interface WoodInputsProps {
  inputs: WoodInputStrings;
  errors: ValidationErrors;
  quality: CalculatorState["quality"];
  onChange: (key: FieldKey, value: string) => void;
  onReset: () => void;
  /** An action beside a group's heading, such as the plate measurement for the frequencies. */
  groupActions?: Partial<Record<GroupId, ReactNode>>;
}

/** One measurement, drawn like the reader's take tile, and editable. */
function ValueTile({
  field,
  name,
  symbol,
  colour,
  value,
  error,
  details,
  onChange,
}: {
  field: FieldKey;
  name: string;
  symbol: ReactNode;
  colour: TileColour;
  value: string;
  error: string | undefined;
  /** Lines under the value, such as the note and the measured Q. */
  details?: ReactNode;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("wood");
  const id = useId();
  const unit = UNITS[field];
  const hintId = isHinted(field) ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
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
          {name}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-2xs text-fg-faint">
          {colour.dot ? (
            <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", colour.dot)} />
          ) : null}
          <span>{symbol}</span>
        </span>
      </label>
      <span className="mt-0.5 flex items-baseline gap-1">
        <input
          id={id}
          type="number"
          step="0.1"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={unit ? `${t(`fields.${field}`)} ${unit}` : t(`fields.${field}`)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          style={{ width: `calc(${Math.max(value.length, 2)}ch + 0.5rem)` }}
          className="-mx-1 min-w-0 max-w-full rounded-md border-b border-dashed border-line-strong bg-transparent px-1 font-mono text-xl font-bold leading-tight tracking-tight text-fg outline-none [appearance:textfield] focus:border-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {unit ? <span className="text-xs text-fg-dim">{unit}</span> : null}
      </span>
      {details}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-xs text-danger-ink">
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {isHinted(field) ? (
        <p id={hintId} className="mt-auto pt-1 text-xs leading-snug text-fg-dim">
          {t(`hints.${field}`)}
        </p>
      ) : null}
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
  const t = useTranslations();
  const locale = useLocale();
  const headingId = useId();
  const q = (value: number | null) =>
    value === null ? t("wood.plate.missing") : formatValue(value, 0, locale);
  const qualityLine = (take: PlateTake) => {
    const measured = quality[take];
    if (!measured) return null;
    return (
      <p className="font-mono text-2xs text-teal-ink">
        {t("wood.plate.quality", { spectral: q(measured.spectralQ), decay: q(measured.decayQ) })}
      </p>
    );
  };
  const errorOf = (key: FieldKey) => {
    const error = errors[key];
    return error ? t(`wood.validation.${error}`) : undefined;
  };
  const tile = (
    field: FieldKey,
    props: Pick<Parameters<typeof ValueTile>[0], "name" | "symbol" | "colour" | "details">,
  ) => (
    <ValueTile
      key={field}
      field={field}
      value={inputs[field]}
      error={errorOf(field)}
      onChange={(value) => onChange(field, value)}
      {...props}
    />
  );
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
              {t(`wood.groups.${group.id}`)}
            </h3>
            {groupActions[group.id]}
          </div>
          <div className={cx("grid gap-2", group.grid)}>
            {group.id === "frequency"
              ? FREQUENCIES.map(({ take, field, colour }) =>
                  tile(field, {
                    name: t(`tapTone.takes.name.${take}`),
                    symbol: (
                      <>
                        f<sub>{TAKE_SYMBOL[take]}</sub>
                      </>
                    ),
                    colour,
                    details: (
                      <>
                        {errors[field] ? null : (
                          <span className="font-mono text-xs text-fg-dim">
                            {noteLabel(Number(inputs[field]))}
                          </span>
                        )}
                        {qualityLine(take)}
                      </>
                    ),
                  }),
                )
              : group.fields.map((field) =>
                  tile(field, {
                    name: t(`wood.tiles.${field}`),
                    symbol: SYMBOLS[field],
                    colour: NEUTRAL,
                  }),
                )}
          </div>
        </fieldset>
      ))}
      <div>
        <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={onReset}>
          {t("wood.reset")}
        </Button>
      </div>
    </div>
  );
}
