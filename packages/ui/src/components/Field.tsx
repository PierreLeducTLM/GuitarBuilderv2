import { CircleAlert } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { cx } from "../cx.ts";

export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Renders the control, wired to the label, hint and error. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, hint and error around any form control, with the ARIA wiring done. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-sm text-fg-dim">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-ink">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Unit shown after the value, for example "mm". Readings use the mono font. */
  unit?: string;
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
  fieldClassName?: string;
}

/** A labelled single-line input with optional hint, error and unit. */
export function TextField({
  label,
  hint,
  error,
  unit,
  mono = false,
  className,
  fieldClassName,
  type = "text",
  ...inputProps
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} className={fieldClassName}>
      {(control) => (
        <div
          className={cx(
            "flex min-h-12 items-center gap-2 rounded-xl border bg-panel px-3.5 transition-[border-color,box-shadow] duration-150 focus-within:border-amber focus-within:shadow-[0_0_0_3px_var(--gb-glow-amber)]",
            error ? "border-danger-ink" : "border-line",
            inputProps.disabled && "opacity-55",
          )}
        >
          <input
            type={type}
            className={cx(
              "min-w-0 flex-1 bg-transparent py-2 text-base text-fg outline-none placeholder:text-fg-faint disabled:cursor-not-allowed",
              mono && "font-mono font-bold",
              className,
            )}
            {...control}
            {...inputProps}
          />
          {unit ? <span className="font-mono text-sm text-fg-dim">{unit}</span> : null}
        </div>
      )}
    </Field>
  );
}
