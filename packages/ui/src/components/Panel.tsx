import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../cx.ts";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article" | "aside";
  /** Panels sit on the ground; `inset` panels sit inside another panel. */
  tone?: "panel" | "inset";
  padding?: "none" | "sm" | "md" | "lg";
  children?: ReactNode;
}

const paddingClasses = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

/** The instrument-panel surface: hairline border, 16 px radius. */
export function Panel({
  as: Element = "div",
  tone = "panel",
  padding = "md",
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Element
      className={cx(
        "rounded-2xl border border-line",
        tone === "panel" ? "bg-panel" : "bg-inset",
        paddingClasses[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Element>
  );
}

/** Alias kept for readability where a card-like panel is meant. */
export const Card = Panel;
