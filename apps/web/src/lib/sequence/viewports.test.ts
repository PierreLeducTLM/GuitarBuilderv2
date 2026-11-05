import { describe, expect, it } from "vitest";
import { forgetDiagramViewports } from "./viewports";

/** A Storage double over a plain list of entries. */
function storage(entries: Record<string, string>): Storage {
  const items = new Map(Object.entries(entries));
  return {
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  };
}

const keys = (store: Storage) =>
  Array.from({ length: store.length }, (_, index) => store.key(index));

describe("forgetDiagramViewports", () => {
  it("removes every viewport the old diagram remembered, and nothing else", () => {
    const store = storage({
      "gb-viewport:b1": '{"x":0,"y":0,"zoom":1}',
      "gb-theme": "dark",
      "gb-viewport:b2": '{"x":4,"y":2,"zoom":0.5}',
      "other-gb-viewport:b3": "kept",
    });
    forgetDiagramViewports(() => store);
    expect(keys(store)).toEqual(["gb-theme", "other-gb-viewport:b3"]);
  });

  it("does nothing when storage cannot be reached", () => {
    expect(() =>
      forgetDiagramViewports(() => {
        throw new Error("SecurityError");
      }),
    ).not.toThrow();
  });
});
