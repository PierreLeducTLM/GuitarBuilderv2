"use client";

import { type ReactNode, useId } from "react";
import { cx } from "../cx.ts";

export interface SegmentedOption<T extends string> {
  value: T;
  /** Visible content: text or an icon. */
  label: ReactNode;
  /** Accessible name when `label` is an icon. */
  ariaLabel?: string;
  /** Tooltip. */
  title?: string;
  /** Extra classes for this option (for example an accent colour). */
  className?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  className?: string;
  /** `mono` sets the labels in JetBrains Mono (for codes such as EN/FR). */
  mono?: boolean;
  disabled?: boolean;
}

/**
 * A single-choice control built on native radio buttons: one tab stop, arrow keys
 * move and select, and the checked segment is highlighted.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
  mono = false,
  disabled = false,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      className={cx(
        "m-0 inline-flex min-w-0 gap-1 rounded-xl border border-line bg-panel p-1",
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            title={option.title}
            data-checked={checked || undefined}
            className={cx(
              "relative inline-flex min-h-11 min-w-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 has-[:disabled]:cursor-not-allowed has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-focus",
              mono ? "font-mono" : "font-sans",
              checked
                ? "bg-selected font-bold text-fg"
                : "font-medium text-fg-dim hover:bg-raised hover:text-fg",
              option.className,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              aria-label={option.ariaLabel}
              onChange={() => onChange(option.value)}
              // Invisible but covering the whole segment, so the native radio is what
              // pointers and assistive technology interact with.
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-lg opacity-0 disabled:cursor-not-allowed"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}
