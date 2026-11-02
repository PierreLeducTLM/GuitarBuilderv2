"use client";

import { type GuitarType, guitarTypes } from "@gb/db";
import { cx } from "@gb/ui";
import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

export interface VariantFieldsProps {
  guitarType: GuitarType | null;
  boboNeck: boolean;
  onGuitarTypeChange: (value: GuitarType) => void;
  onBoboNeckChange: (value: boolean) => void;
  guitarTypeError?: string;
  disabled?: boolean;
}

/**
 * The construction-variant fields shared by "Add New Build" and "Change": guitar type
 * (native radios, nothing preselected for a new build) and the BOBO neck checkbox.
 */
export function VariantFields({
  guitarType,
  boboNeck,
  onGuitarTypeChange,
  onBoboNeckChange,
  guitarTypeError,
  disabled = false,
}: VariantFieldsProps) {
  const t = useTranslations("builds");
  const id = useId();
  const errorId = guitarTypeError ? `${id}-error` : undefined;
  return (
    <>
      <fieldset disabled={disabled} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 text-sm font-semibold text-fg">{t("create.typeLabel")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {guitarTypes.map((value) => (
            <label
              key={value}
              className={cx(
                "relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-[0.9375rem] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55",
                guitarType === value
                  ? "border-amber bg-amber-soft font-semibold text-fg"
                  : guitarTypeError
                    ? "border-danger-ink bg-panel text-fg"
                    : "border-line bg-panel text-fg hover:bg-raised",
              )}
            >
              <input
                type="radio"
                name={`${id}-guitar-type`}
                value={value}
                checked={guitarType === value}
                onChange={() => onGuitarTypeChange(value)}
                aria-describedby={errorId}
                aria-invalid={guitarTypeError ? true : undefined}
                className="size-4 shrink-0 accent-amber"
              />
              {t(`guitarType.${value}`)}
            </label>
          ))}
        </div>
        {guitarTypeError ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-ink">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{guitarTypeError}</span>
          </p>
        ) : null}
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[0.9375rem] text-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55">
        <input
          type="checkbox"
          checked={boboNeck}
          disabled={disabled}
          onChange={(event) => onBoboNeckChange(event.target.checked)}
          className="size-5 shrink-0 accent-amber"
        />
        {t("create.boboLabel")}
      </label>
    </>
  );
}
