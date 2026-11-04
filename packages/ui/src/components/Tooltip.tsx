"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { type ReactElement, type ReactNode, useRef, useState } from "react";
import { cx } from "../cx.ts";

export interface TooltipProps {
  content: ReactNode;
  /** The trigger: a focusable element such as an icon button. */
  children: ReactElement;
  className?: string;
}

/** Help text that opens on hover and keyboard focus, and toggles on a tap. */
export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tappedByTouch = useRef(false);
  return (
    <RadixTooltip.Provider delayDuration={200}>
      <RadixTooltip.Root open={open} onOpenChange={setOpen}>
        <RadixTooltip.Trigger
          asChild
          onPointerDown={(event) => {
            tappedByTouch.current = event.pointerType === "touch";
            if (tappedByTouch.current) setOpen((wasOpen) => !wasOpen);
          }}
          onClick={(event) => {
            if (tappedByTouch.current) event.preventDefault();
          }}
        >
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            sideOffset={8}
            collisionPadding={16}
            className={cx(
              "z-50 max-w-80 animate-fade-in rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm text-fg shadow-panel",
              className,
            )}
          >
            {content}
            <RadixTooltip.Arrow className="fill-line" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
