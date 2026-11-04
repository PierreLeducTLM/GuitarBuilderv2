"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "../cx.ts";
import { IconButton } from "./IconButton.tsx";

export interface DialogFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Description announced with the dialog; required so the dialog is self-explanatory. */
  description?: ReactNode;
  /** Accessible name of the × button. */
  closeLabel: string;
  icon?: ReactNode;
  /** Stacking layer: `top` dialogs appear above any other open dialog. */
  layer?: "base" | "top";
  /** `lg` widens the dialog for rich content; `xl` is a workbench that fills a phone's screen. */
  size?: "md" | "lg" | "xl";
  /** False keeps the dialog open when the backdrop is clicked, for work that must not be lost. */
  dismissOnOutsideClick?: boolean;
  onOpenAutoFocus?: (event: Event) => void;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Modal frame shared by the app's dialogs: dimmed backdrop (click dismisses),
 * focus trap, Escape, scroll lock and a × close button, via Radix Dialog.
 */
export function DialogFrame({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  icon,
  layer = "base",
  size = "md",
  dismissOnOutsideClick = true,
  onOpenAutoFocus,
  children,
  footer,
}: DialogFrameProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          data-testid="dialog-backdrop"
          className={cx(
            "fixed inset-0 animate-fade-in bg-overlay",
            layer === "top" ? "z-[60]" : "z-50",
          )}
        />
        <RadixDialog.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onInteractOutside={(event) => {
            if (!dismissOnOutsideClick) event.preventDefault();
          }}
          // Without a description, tell Radix there is none on purpose.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cx(
            "fixed top-1/2 left-1/2 flex max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 animate-fade-in flex-col gap-4 overflow-y-auto rounded-3xl border border-line bg-panel p-5 shadow-panel",
            size === "xl"
              ? "w-[min(60rem,calc(100vw-2rem))] max-sm:inset-0 max-sm:max-h-dvh max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
              : size === "lg"
                ? "w-[min(44rem,calc(100vw-2rem))]"
                : "w-[min(28rem,calc(100vw-2rem))]",
            layer === "top" ? "z-[61]" : "z-[51]",
          )}
        >
          <div className="flex items-start gap-3">
            {icon ? (
              <span aria-hidden="true" className="mt-1 inline-flex shrink-0">
                {icon}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <RadixDialog.Title className="text-xl font-semibold tracking-tight text-fg">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-[0.9375rem] leading-snug text-fg-dim">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close asChild>
              <IconButton label={closeLabel} variant="ghost" className="-mt-1 -mr-1">
                <X className="size-4" />
              </IconButton>
            </RadixDialog.Close>
          </div>
          {children}
          {footer ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
