"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton.tsx";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible title; shown at the top of the sheet. */
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
}

/**
 * A panel that slides in from the right over a dimmed, non-scrolling page. Tapping
 * the backdrop, the × button or pressing Escape closes it.
 */
export function Sheet({ open, onOpenChange, title, closeLabel, children }: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          data-testid="sheet-backdrop"
          className="fixed inset-0 z-40 animate-fade-in bg-overlay"
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-0 right-0 z-[41] flex h-dvh w-[min(20rem,88vw)] animate-sheet-in flex-col gap-5 overflow-y-auto border-l border-line bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-panel"
        >
          <div className="flex items-center justify-between gap-3">
            <RadixDialog.Title className="font-mono text-2xs tracking-wider text-fg-dim uppercase">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label={closeLabel}>
                <X className="size-4" />
              </IconButton>
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Closes the surrounding sheet when the wrapped element is activated. */
export const SheetClose = RadixDialog.Close;
