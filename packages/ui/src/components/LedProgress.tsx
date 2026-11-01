import type { ReactNode } from "react";
import { cx } from "../cx.ts";

export interface LedProgressProps {
  value: number;
  max: number;
  /** Accessible name, for example "Build progress". */
  label: string;
  /** Spoken and shown value, already formatted for the locale (e.g. "30 / 120"). */
  valueText?: string;
  /** Number of LED segments (default 24). */
  segments?: number;
  /** Optional heading row content shown above the segments. */
  heading?: ReactNode;
  className?: string;
}

/** Number of lit segments: rounded, but at least one as soon as there is progress. */
export function litSegments(value: number, max: number, segments: number): number {
  if (max <= 0 || value <= 0) return 0;
  const ratio = Math.min(1, value / max);
  return Math.max(1, Math.round(ratio * segments));
}

/** LED-segment progress meter with `progressbar` semantics. */
export function LedProgress({
  value,
  max,
  label,
  valueText,
  segments = 24,
  heading,
  className,
}: LedProgressProps) {
  const lit = litSegments(value, max, segments);
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      {heading || valueText ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-fg">{heading ?? label}</span>
          {valueText ? (
            <span className="font-mono text-[0.8125rem] text-fg-dim">{valueText}</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), max)}
        aria-valuetext={valueText}
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: segments }, (_, index) => (
          <span
            // Segments are positional and never reorder.
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length, static list
            key={index}
            data-lit={index < lit || undefined}
            className={cx(
              "h-3.5 rounded-[2px]",
              index < lit ? "bg-teal" : "bg-line",
              index === lit - 1 && "shadow-glow-teal",
            )}
          />
        ))}
      </div>
    </div>
  );
}
