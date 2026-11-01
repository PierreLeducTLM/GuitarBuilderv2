"use client";

import { CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../cx.ts";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type: ToastType;
  message: ReactNode;
  /** Milliseconds before the toast starts fading out (default 3000). */
  duration?: number;
}

export interface ToastItem extends Required<ToastOptions> {
  id: number;
  leaving: boolean;
}

export const TOAST_DEFAULT_DURATION_MS = 3000;
export const TOAST_FADE_MS = 300;

interface ToastApi {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const typeStyles: Record<ToastType, { icon: ReactNode; stripe: string }> = {
  success: { icon: <CircleCheck className="size-5 text-teal-ink" />, stripe: "bg-teal-ink" },
  error: { icon: <CircleX className="size-5 text-danger-ink" />, stripe: "bg-danger-ink" },
  warning: { icon: <TriangleAlert className="size-5 text-amber-ink" />, stripe: "bg-amber-ink" },
  info: { icon: <Info className="size-5 text-info-ink" />, stripe: "bg-info-ink" },
};

export interface ToastProviderProps {
  children: ReactNode;
  /** Accessible name of each toast's × button. */
  closeLabel: string;
  /** Accessible name of the notification region. */
  regionLabel: string;
  /** Spoken prefix per type, e.g. "Error". */
  typeLabels: Record<ToastType, string>;
}

/**
 * Transient notifications shown over the page. Toasts stack without overlapping,
 * never block the page, fade out after their duration and can be closed at once.
 */
export function ToastProvider({
  children,
  closeLabel,
  regionLabel,
  typeLabels,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>());

  const clearTimers = useCallback((id: number) => {
    for (const timer of timers.current.get(id) ?? []) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimers(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    },
    [clearTimers],
  );

  const show = useCallback(
    ({ type, message, duration = TOAST_DEFAULT_DURATION_MS }: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, type, message, duration, leaving: false }]);
      const fade = setTimeout(() => {
        setToasts((current) =>
          current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
        );
      }, duration);
      const remove = setTimeout(() => dismiss(id), duration + TOAST_FADE_MS);
      timers.current.set(id, [fade, remove]);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const list of active.values()) for (const timer of list) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label={regionLabel}
        className="pointer-events-none fixed top-4 right-4 left-4 z-[70] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              role={toast.type === "error" ? "alert" : "status"}
              data-type={toast.type}
              data-leaving={toast.leaving || undefined}
              style={{ transitionDuration: `${TOAST_FADE_MS}ms` }}
              className={cx(
                "pointer-events-auto relative flex w-full animate-toast-in items-start gap-3 overflow-hidden rounded-2xl border border-line bg-panel py-3 pr-2 pl-4 shadow-panel transition-opacity",
                toast.leaving && "opacity-0",
              )}
            >
              <span
                aria-hidden="true"
                className={cx("absolute inset-y-0 left-0 w-1", style.stripe)}
              />
              <span aria-hidden="true" className="mt-0.5 inline-flex shrink-0">
                {style.icon}
              </span>
              <p className="min-w-0 flex-1 py-0.5 text-[0.9375rem] leading-snug text-fg">
                <span className="sr-only">{typeLabels[toast.type]}: </span>
                {toast.message}
              </p>
              <button
                type="button"
                aria-label={closeLabel}
                title={closeLabel}
                onClick={() => dismiss(toast.id)}
                className="-my-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-fg-dim hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}

/** Raise toasts from any component inside `ToastProvider`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
