"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button.tsx";
import { DialogFrame } from "./Dialog.tsx";

export interface TextInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  message?: ReactNode;
  /** Accessible name of the input (visually hidden). */
  inputLabel: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  /** Receives the entered text with surrounding whitespace removed. */
  onConfirm: (value: string) => void;
}

/**
 * Asks for one line of text. Opens with the initial value focused and selected;
 * Enter or the confirm button returns the trimmed value, and confirming is disabled
 * while the trimmed value is empty. Appears above any other open dialog.
 */
export function TextInputDialog({
  open,
  onOpenChange,
  title,
  message,
  inputLabel,
  placeholder,
  initialValue = "",
  confirmLabel,
  cancelLabel,
  closeLabel,
  onConfirm,
}: TextInputDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const trimmed = value.trim();

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    onConfirm(trimmed);
    onOpenChange(false);
  }

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={message}
      closeLabel={closeLabel}
      layer="top"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label htmlFor={inputId} className="sr-only">
          {inputLabel}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-12 rounded-xl border border-line bg-inset px-3.5 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-faint focus:border-amber focus:shadow-[0_0_0_3px_var(--gb-glow-amber)]"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </DialogFrame>
  );
}
