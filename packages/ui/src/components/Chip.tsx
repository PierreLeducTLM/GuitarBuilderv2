import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx.ts";

export type ChipTone = "neutral" | "done" | "signal" | "admin" | "danger";

const toneClasses: Record<ChipTone, { chip: string; dot: string }> = {
  neutral: { chip: "border-line bg-panel text-fg", dot: "bg-fg-dim" },
  done: {
    chip: "border-teal-line bg-teal-soft text-teal-ink",
    dot: "bg-teal-ink shadow-glow-teal",
  },
  signal: { chip: "border-amber-ink bg-amber-soft text-amber-ink", dot: "bg-amber-ink" },
  admin: { chip: "border-admin-ink bg-admin-soft text-admin-ink", dot: "bg-admin-ink" },
  danger: { chip: "border-danger-ink bg-danger-soft text-danger-ink", dot: "bg-danger-ink" },
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  /** Show the status dot (default true). */
  dot?: boolean;
  children: ReactNode;
}

/** A small status or attribute label, e.g. "Steel-string" or "Completed". */
export function Chip({ tone = "neutral", dot = true, className, children, ...rest }: ChipProps) {
  const classes = toneClasses[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.8125rem] leading-none",
        classes.chip,
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", classes.dot)} />
      ) : null}
      {children}
    </span>
  );
}
