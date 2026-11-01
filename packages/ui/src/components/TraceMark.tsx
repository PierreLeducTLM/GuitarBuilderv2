import { cx } from "../cx.ts";

export interface TraceMarkProps {
  size?: number;
  /** Accessible name; when omitted the mark is decorative. */
  title?: string;
  /** Animate the trace (loading screens). */
  animated?: boolean;
  className?: string;
}

/** The Guitar Builder mark: an amber phosphor trace on a panel tile. */
export function TraceMark({ size = 36, title, animated = false, className }: TraceMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cx("shrink-0", className)}
    >
      <rect
        x="1"
        y="1"
        width="58"
        height="58"
        rx="14"
        className="fill-panel stroke-line"
        strokeWidth="2"
      />
      <path d="M10 30 H52" className="stroke-line" strokeWidth="1" />
      <path
        d="M10 30 C14 30 15 14 19 14 C23 14 24 46 28 46 C32 46 33 20 37 20 C41 20 42 38 46 38 C49 38 50 30 52 30"
        fill="none"
        className={cx("stroke-amber-ink", animated && "animate-trace")}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={animated ? "120 120" : undefined}
        style={{ filter: "drop-shadow(0 0 4px var(--gb-glow-amber))" }}
      />
    </svg>
  );
}
