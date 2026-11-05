// A build's step state on the client and the queue that saves it (build-sequence: Step
// State Persistence, Step Notes, Step Save Failures).
//
// The view is the server-confirmed state with every queued change applied on top, then
// the notes being typed. Changes are sent one at a time, in order, through
// update_build_step, so a completion sent after notes always lands after them. Notes are
// saved a moment after typing stops, and immediately before any other change to the same
// step, when the dialog closes or when the page is hidden.
import type { StepChange, StepEntry } from "@gb/db";
import { EMPTY_STEP_STATE, type StepState, type StepStates, stepState, toStepState } from "./state";
import type { StepKey } from "./template";

/** Delay after the last keystroke before notes are saved, ms. */
export const NOTES_SAVE_DELAY_MS = 500;

/** One step's state after a change, as update_build_step computes it. */
export function applyStepChange(state: StepState, change: StepChange): StepState {
  switch (change.op) {
    case "set_completed":
      return { ...state, completed: change.completed };
    case "set_notes":
      return { ...state, notes: change.notes };
    case "add_photos":
      return { ...state, photos: [...state.photos, ...change.photos] };
    case "remove_photo":
      return { ...state, photos: state.photos.filter((photo) => photo.name !== change.name) };
    case "add_measurement":
      return {
        ...state,
        measurements: [
          ...state.measurements,
          { ...change.measurement, description: change.measurement.description.trim() },
        ],
      };
    case "set_measurement_description":
      return {
        ...state,
        measurements: state.measurements.map((measurement) =>
          measurement.id === change.id
            ? { ...measurement, description: change.description.trim() }
            : measurement,
        ),
      };
    case "remove_measurement":
      return {
        ...state,
        measurements: state.measurements.filter((measurement) => measurement.id !== change.id),
      };
  }
}

interface QueuedChange {
  key: StepKey;
  change: StepChange;
  /** Report a failure without the generic "Failed to save changes" message. */
  silent: boolean;
  settle: (saved: boolean) => void;
}

export interface StepStoreOptions {
  initial: StepStates;
  /** Sends one change; resolves with the step's saved entry, rejects on failure. */
  save: (key: StepKey, change: StepChange) => Promise<StepEntry>;
  /** Called when a change could not be saved (unless it was queued as silent). */
  onSaveFailed: () => void;
  /** Called after each change the server saved. */
  onSaved?: () => void;
  notesDelayMs?: number;
  /** Timer functions, replaceable in tests. */
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class StepStore {
  private confirmed: StepStates;
  private readonly queue: QueuedChange[] = [];
  private readonly drafts = new Map<StepKey, string>();
  private readonly timers = new Map<StepKey, unknown>();
  private readonly listeners = new Set<() => void>();
  private sending = false;
  private snapshot: StepStates;
  private readonly options: Required<
    Pick<StepStoreOptions, "notesDelayMs" | "setTimer" | "clearTimer">
  > &
    StepStoreOptions;

  constructor(options: StepStoreOptions) {
    this.options = {
      notesDelayMs: NOTES_SAVE_DELAY_MS,
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      ...options,
    };
    this.confirmed = { ...options.initial };
    this.snapshot = this.compute();
  }

  /** For useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The state to display: confirmed, plus queued changes, plus notes being typed. */
  getSnapshot = (): StepStates => this.snapshot;

  /** Whether changes are waiting to be saved. */
  get busy(): boolean {
    return this.sending || this.queue.length > 0 || this.timers.size > 0;
  }

  /**
   * Queues a change to one step. Resolves true once saved, or false when it failed, in
   * which case the change is no longer shown.
   */
  change(key: StepKey, change: StepChange, { silent = false } = {}): Promise<boolean> {
    this.flushNotes(key);
    return this.enqueue(key, change, silent);
  }

  /** Shows typed notes at once and saves them shortly after typing stops. */
  setNotes(key: StepKey, notes: string): void {
    this.drafts.set(key, notes);
    const timer = this.timers.get(key);
    if (timer !== undefined) this.options.clearTimer(timer);
    this.timers.set(
      key,
      this.options.setTimer(() => this.flushNotes(key), this.options.notesDelayMs),
    );
    this.emit();
  }

  /** Saves pending notes now: of one step, or of every step. */
  flushNotes(key?: StepKey): void {
    const keys = key ? [key] : [...this.timers.keys()];
    for (const current of keys) {
      const timer = this.timers.get(current);
      if (timer === undefined) continue;
      this.options.clearTimer(timer);
      this.timers.delete(current);
      const notes = this.drafts.get(current);
      this.drafts.delete(current);
      if (notes !== undefined) {
        void this.enqueue(current, { op: "set_notes", notes }, false).then((saved) => {
          // Keep text that could not be saved in the field; the next edit sends it again.
          if (!saved && !this.drafts.has(current)) {
            this.drafts.set(current, notes);
            this.emit();
          }
        });
      }
    }
  }

  private enqueue(key: StepKey, change: StepChange, silent: boolean): Promise<boolean> {
    return new Promise<boolean>((settle) => {
      this.queue.push({ key, change, silent, settle });
      this.emit();
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    while (this.queue.length > 0) {
      const next = this.queue[0] as QueuedChange;
      let saved = false;
      try {
        const entry = await this.options.save(next.key, next.change);
        this.confirmed = { ...this.confirmed, [next.key]: toStepState(entry) };
        saved = true;
      } catch {
        saved = false;
      }
      this.queue.shift();
      this.emit();
      if (saved) this.options.onSaved?.();
      if (!saved && !next.silent) this.options.onSaveFailed();
      next.settle(saved);
    }
    this.sending = false;
  }

  private compute(): StepStates {
    const view: StepStates = { ...this.confirmed };
    for (const queued of this.queue) {
      view[queued.key] = applyStepChange(stepState(view, queued.key), queued.change);
    }
    for (const [key, notes] of this.drafts) {
      view[key] = { ...(view[key] ?? EMPTY_STEP_STATE), notes };
    }
    return view;
  }

  private emit(): void {
    this.snapshot = this.compute();
    for (const listener of this.listeners) listener();
  }
}
