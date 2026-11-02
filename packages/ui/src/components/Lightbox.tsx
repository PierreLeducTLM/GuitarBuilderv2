"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton.tsx";

export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  /** Accessible name of the × button. */
  closeLabel: string;
  /** Optional controls shown over the image (for example previous and next). */
  children?: ReactNode;
}

/**
 * A photo shown full screen over a dark backdrop, scaled to fit. The × button, Escape or
 * a click outside the photo closes it. Opens above any other dialog.
 */
export function Lightbox({ open, onOpenChange, src, alt, closeLabel, children }: LightboxProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          data-testid="lightbox-backdrop"
          className="fixed inset-0 z-[70] animate-fade-in bg-ground/95"
        />
        <RadixDialog.Content
          aria-describedby={undefined}
          onClick={(event) => {
            // The content box covers the screen; only the photo itself keeps it open.
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          className="fixed inset-0 z-[71] flex animate-fade-in items-center justify-center p-4 sm:p-10"
        >
          <RadixDialog.Title className="sr-only">{alt}</RadixDialog.Title>
          {/* biome-ignore lint/performance/noImgElement: user photos from public storage, shown at their own size */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-panel"
          />
          <RadixDialog.Close asChild>
            <IconButton label={closeLabel} variant="secondary" className="absolute top-3 right-3">
              <X className="size-5" />
            </IconButton>
          </RadixDialog.Close>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
