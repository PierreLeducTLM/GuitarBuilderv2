import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cx } from "../cx.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-amber text-on-amber font-bold shadow-glow-amber hover:brightness-110 active:brightness-95",
  secondary: "border border-line-strong bg-panel text-fg font-semibold hover:bg-raised",
  ghost: "bg-transparent text-fg-dim font-semibold hover:bg-raised hover:text-fg",
  danger: "bg-danger text-on-danger font-bold hover:brightness-110 active:brightness-95",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** `lg` is the 52 px confirm-style button; `md` (44 px) is the default. */
  size?: "md" | "lg";
  /** Decorative icon shown before the label. */
  icon?: ReactNode;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export const buttonBaseClasses =
  "inline-flex select-none items-center justify-center gap-2 rounded-xl font-sans transition-[background-color,color,filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none";

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth"> = {}): string {
  return cx(
    buttonBaseClasses,
    size === "lg" ? "min-h-13 px-5 text-base" : "min-h-11 px-4 text-[0.9375rem]",
    variantClasses[variant],
    fullWidth && "w-full",
  );
}

/** A real `<button>` with the Oscilloscope look. Defaults to `type="button"`. */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
