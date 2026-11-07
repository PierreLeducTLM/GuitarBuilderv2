"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { useId } from "react";
import { cx } from "../cx.ts";

export interface SwitchProps {
  /** Visible label, also the switch's accessible name. */
  label: string;
  /** Optional status line under the label, read as the switch's description. */
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** An on/off switch with its label, amber when on. The label also toggles it. */
export function Switch({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className={cx("flex items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-sm text-fg-dim">
            {description}
          </span>
        ) : null}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? descriptionId : undefined}
        className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-inset transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-amber data-[state=checked]:bg-amber"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-fg-dim transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-amber" />
      </RadixSwitch.Root>
    </div>
  );
}
