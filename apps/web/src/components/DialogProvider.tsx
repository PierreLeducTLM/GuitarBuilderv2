"use client";

import { ConfirmDialog, type ConfirmSeverity, TextInputDialog } from "@gb/ui";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ConfirmOptions {
  title: ReactNode;
  message: ReactNode;
  /** Defaults to the localized "Confirm". */
  confirmLabel?: string;
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
  /** Defaults to warning; danger is for irreversible deletions. */
  variant?: ConfirmSeverity;
}

export interface PromptOptions {
  title: ReactNode;
  message?: ReactNode;
  /** Accessible name of the input; defaults to the title when it is text. */
  inputLabel?: string;
  placeholder?: string;
  initialValue?: string;
  /** Defaults to the localized "Save". */
  confirmLabel?: string;
  /** Defaults to the localized "Cancel". */
  cancelLabel?: string;
}

interface DialogApi {
  /** Resolves true only when the user confirms (app-shell: Confirmation Dialog). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolves the trimmed text, or null when dismissed (app-shell: Text Input Dialog). */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

interface Pending<O, R> {
  options: O;
  resolve: (value: R) => void;
}

/** App-wide confirmation and text-input dialogs with localized default labels. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("dialog");
  const [confirmState, setConfirmState] = useState<Pending<ConfirmOptions, boolean> | null>(null);
  const [promptState, setPromptState] = useState<Pending<PromptOptions, string | null> | null>(
    null,
  );
  const confirmRef = useRef(confirmState);
  confirmRef.current = confirmState;
  const promptRef = useRef(promptState);
  promptRef.current = promptState;

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        confirmRef.current?.resolve(false);
        setConfirmState({ options, resolve });
      }),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        promptRef.current?.resolve(null);
        setPromptState({ options, resolve });
      }),
    [],
  );

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);
  const confirmOptions = confirmState?.options;
  const promptOptions = promptState?.options;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {confirmState && confirmOptions ? (
        <ConfirmDialog
          open
          title={confirmOptions.title}
          message={confirmOptions.message}
          confirmLabel={confirmOptions.confirmLabel ?? t("confirm")}
          cancelLabel={confirmOptions.cancelLabel ?? t("cancel")}
          closeLabel={t("close")}
          variant={confirmOptions.variant ?? "warning"}
          onConfirm={() => confirmState.resolve(true)}
          onOpenChange={(open) => {
            if (open) return;
            confirmState.resolve(false);
            setConfirmState(null);
          }}
        />
      ) : null}
      {promptState && promptOptions ? (
        <TextInputDialog
          open
          title={promptOptions.title}
          message={promptOptions.message}
          inputLabel={
            promptOptions.inputLabel ??
            (typeof promptOptions.title === "string" ? promptOptions.title : t("save"))
          }
          placeholder={promptOptions.placeholder}
          initialValue={promptOptions.initialValue}
          confirmLabel={promptOptions.confirmLabel ?? t("save")}
          cancelLabel={promptOptions.cancelLabel ?? t("cancel")}
          closeLabel={t("close")}
          onConfirm={(value) => promptState.resolve(value)}
          onOpenChange={(open) => {
            if (open) return;
            promptState.resolve(null);
            setPromptState(null);
          }}
        />
      ) : null}
    </DialogContext.Provider>
  );
}

function useDialogs(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("Dialog hooks must be used inside <DialogProvider>");
  return api;
}

export function useConfirm() {
  return useDialogs().confirm;
}

export function usePrompt() {
  return useDialogs().prompt;
}
