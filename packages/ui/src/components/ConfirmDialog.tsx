"use client";

import { Info, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "./Button.tsx";
import { DialogFrame } from "./Dialog.tsx";

export type ConfirmSeverity = "danger" | "warning" | "info";

const severityButton: Record<ConfirmSeverity, ButtonVariant> = {
  danger: "danger",
  warning: "primary",
  info: "secondary",
};

const severityIcon: Record<ConfirmSeverity, ReactNode> = {
  danger: <OctagonAlert className="size-5 text-danger-ink" />,
  warning: <TriangleAlert className="size-5 text-amber-ink" />,
  info: <Info className="size-5 text-info-ink" />,
};

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  /** Emphasis of the confirm button; `danger` is for irreversible deletions. */
  variant?: ConfirmSeverity;
  /** Runs only when the user confirms; the dialog then closes. */
  onConfirm: () => void;
}

/**
 * Asks before a destructive or significant action. Cancel, × and the backdrop all
 * dismiss it without running the action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  variant = "warning",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={message}
      closeLabel={closeLabel}
      icon={severityIcon[variant]}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={severityButton[variant]}
            data-severity={variant}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
