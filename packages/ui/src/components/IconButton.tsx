import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../cx.ts";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  /** Accessible name, also shown as the tooltip. Required: the button has no visible text. */
  label: string;
  /** The icon; it is hidden from assistive technology. */
  children: ReactNode;
  variant?: "secondary" | "ghost";
  ref?: Ref<HTMLButtonElement>;
}

/** A 44 × 44 px icon-only button that always carries an accessible name. */
export function IconButton({
  label,
  children,
  variant = "secondary",
  className,
  type = "button",
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-fg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55",
        variant === "secondary"
          ? "border border-line bg-panel hover:bg-raised"
          : "bg-transparent hover:bg-raised",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </button>
  );
}
