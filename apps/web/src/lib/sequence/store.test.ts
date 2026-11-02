import type { StepChange, StepEntry } from "@gb/db";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_STEP_STATE } from "./state";
import { applyStepChange, StepStore } from "./store";
import type { StepKey } from "./template";

/** A fake server applying changes like update_build_step, with controllable answers. */
function fakeServer() {
  const stored = new Map<StepKey, StepEntry>();
  const calls: { key: StepKey; change: StepChange }[] = [];
  const pending: { resolve: () => void; reject: () => void }[] = [];
  let autoAnswer = true;
  let failNext = 0;
  const save = (key: StepKey, change: StepChange) =>
    new Promise<StepEntry>((resolve, reject) => {
      calls.push({ key, change });
      const answer = () => {
        if (failNext > 0) {
          failNext--;
          reject(new Error("refused"));
          return;
        }
        const current = stored.get(key) ?? { key, ...EMPTY_STEP_STATE };
        const next = { key, ...applyStepChange(current, change) };
        stored.set(key, next);
        resolve(next);
      };
      if (autoAnswer) queueMicrotask(answer);
      else pending.push({ resolve: answer, reject: () => reject(new Error("refused")) });
    });
  return {
    save,
    calls,
    stored,
    hold() {
      autoAnswer = false;
    },
    releaseOne() {
      pending.shift()?.resolve();
    },
    failNext(count = 1) {
      failNext = count;
    },
  };
}

/** Manual timers, so the notes delay can be stepped. */
function manualTimers() {
  const callbacks = new Map<number, () => void>();
  let next = 0;
  return {
    setTimer: (callback: () => void) => {
      next++;
      callbacks.set(next, callback);
      return next;
    },
    clearTimer: (handle: unknown) => callbacks.delete(handle as number),
    fireAll() {
      for (const [id, callback] of [...callbacks]) {
        callbacks.delete(id);
        callback();
      }
    },
    get count() {
      return callbacks.size;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("applyStepChange", () => {
  it("applies each operation like update_build_step", () => {
    let state = applyStepChange(EMPTY_STEP_STATE, { op: "set_completed", completed: true });
    state = applyStepChange(state, { op: "set_notes", notes: "a\nb" });
    state = applyStepChange(state, {
      op: "add_photos",
      photos: [
        { url: "u1", name: "1_a.jpg" },
        { url: "u2", name: "2_b.jpg" },
        { url: "u3", name: "3_c.jpg" },
      ],
    });
    state = applyStepChange(state, { op: "remove_photo", name: "2_b.jpg" });
    expect(state.completed).toBe(true);
    expect(state.notes).toBe("a\nb");
    expect(state.photos.map((p) => p.name)).toEqual(["1_a.jpg", "3_c.jpg"]);
  });
});

describe("StepStore", () => {
  it("shows a change at once and keeps it once saved", async () => {
    const server = fakeServer();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed: vi.fn() });
    const saved = store.change("Neck", { op: "set_completed", completed: true });
    expect(store.getSnapshot().Neck?.completed).toBe(true);
    expect(await saved).toBe(true);
    expect(store.getSnapshot().Neck?.completed).toBe(true);
    expect(server.stored.get("Neck")?.completed).toBe(true);
  });

  it("sends changes one at a time, in order", async () => {
    const server = fakeServer();
    server.hold();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed: vi.fn() });
    void store.change("Neck", { op: "set_completed", completed: true });
    void store.change("Neck", { op: "set_completed", completed: false });
    void store.change("Crown", { op: "set_completed", completed: true });
    await settle();
    expect(server.calls).toHaveLength(1);
    server.releaseOne();
    await settle();
    expect(server.calls).toHaveLength(2);
    server.releaseOne();
    await settle();
    server.releaseOne();
    await settle();
    expect(server.calls.map((call) => [call.key, call.change])).toEqual([
      ["Neck", { op: "set_completed", completed: true }],
      ["Neck", { op: "set_completed", completed: false }],
      ["Crown", { op: "set_completed", completed: true }],
    ]);
    expect(store.getSnapshot().Neck?.completed).toBe(false);
    expect(store.busy).toBe(false);
  });

  it("saves notes once typing stops, with only the last text", async () => {
    const server = fakeServer();
    const timers = manualTimers();
    const store = new StepStore({
      initial: {},
      save: server.save,
      onSaveFailed: vi.fn(),
      ...timers,
    });
    store.setNotes("CutBraceBlank", "Used");
    store.setNotes("CutBraceBlank", "Used 3 mm");
    store.setNotes("CutBraceBlank", "Used 3 mm brace stock");
    expect(store.getSnapshot().CutBraceBlank?.notes).toBe("Used 3 mm brace stock");
    expect(server.calls).toHaveLength(0);
    expect(timers.count).toBe(1);
    timers.fireAll();
    await settle();
    expect(server.calls).toEqual([
      { key: "CutBraceBlank", change: { op: "set_notes", notes: "Used 3 mm brace stock" } },
    ]);
  });

  it("saves pending notes before completing the same step", async () => {
    const server = fakeServer();
    const timers = manualTimers();
    const store = new StepStore({
      initial: {},
      save: server.save,
      onSaveFailed: vi.fn(),
      ...timers,
    });
    store.setNotes("ThicknessBlank", "Planed to 4.2 mm");
    await store.change("ThicknessBlank", { op: "set_completed", completed: true });
    await settle();
    expect(server.calls.map((call) => call.change.op)).toEqual(["set_notes", "set_completed"]);
    expect(server.stored.get("ThicknessBlank")).toMatchObject({
      notes: "Planed to 4.2 mm",
      completed: true,
    });
    expect(timers.count).toBe(0);
  });

  it("flushes every step's pending notes on demand", async () => {
    const server = fakeServer();
    const timers = manualTimers();
    const store = new StepStore({
      initial: {},
      save: server.save,
      onSaveFailed: vi.fn(),
      ...timers,
    });
    store.setNotes("Neck", "a");
    store.setNotes("Crown", "b");
    store.flushNotes();
    await settle();
    expect(server.calls.map((call) => call.key).sort()).toEqual(["Crown", "Neck"]);
    expect(store.busy).toBe(false);
  });

  it("reverts a change that could not be saved and reports it", async () => {
    const server = fakeServer();
    server.failNext();
    const onSaveFailed = vi.fn();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed });
    const saved = await store.change("ThicknessBlank", { op: "set_completed", completed: true });
    expect(saved).toBe(false);
    expect(onSaveFailed).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().ThicknessBlank?.completed ?? false).toBe(false);
  });

  it("lets the caller report a silent failure itself", async () => {
    const server = fakeServer();
    server.failNext();
    const onSaveFailed = vi.fn();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed });
    const saved = await store.change(
      "Neck",
      { op: "add_photos", photos: [{ url: "u", name: "1_a.jpg" }] },
      { silent: true },
    );
    expect(saved).toBe(false);
    expect(onSaveFailed).not.toHaveBeenCalled();
    expect(store.getSnapshot().Neck?.photos ?? []).toEqual([]);
  });

  it("keeps notes that failed to save in the field and sends them with the next edit", async () => {
    const server = fakeServer();
    const timers = manualTimers();
    const onSaveFailed = vi.fn();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed, ...timers });
    server.failNext();
    store.setNotes("CutBraceBlank", "Used 3 mm brace stock");
    timers.fireAll();
    await settle();
    await settle();
    expect(onSaveFailed).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().CutBraceBlank?.notes).toBe("Used 3 mm brace stock");

    store.setNotes("CutBraceBlank", "Used 3 mm brace stock, quartersawn");
    timers.fireAll();
    await settle();
    expect(server.stored.get("CutBraceBlank")?.notes).toBe("Used 3 mm brace stock, quartersawn");
  });

  it("starts from the stored state and keeps other steps when one changes", async () => {
    const server = fakeServer();
    const store = new StepStore({
      initial: { Neck: { ...EMPTY_STEP_STATE, notes: "Mahogany" } },
      save: server.save,
      onSaveFailed: vi.fn(),
    });
    await store.change("Crown", { op: "set_completed", completed: true });
    expect(store.getSnapshot().Neck?.notes).toBe("Mahogany");
    expect(store.getSnapshot().Crown?.completed).toBe(true);
  });

  it("notifies subscribers of every change", async () => {
    const server = fakeServer();
    const store = new StepStore({ initial: {}, save: server.save, onSaveFailed: vi.fn() });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    await store.change("Neck", { op: "set_completed", completed: true });
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await store.change("Neck", { op: "set_completed", completed: false });
    expect(listener).not.toHaveBeenCalled();
  });
});
