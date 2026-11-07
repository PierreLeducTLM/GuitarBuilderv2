import { describe, expect, it } from "vitest";
import { type RememberedCheck, readCheck, rememberCheck } from "./memory";

const KEY = "gb.microphoneChecks.v1";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  const storage: Storage = {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
  return { storage, items };
};

const check = (overrides: Partial<RememberedCheck> = {}): RememberedCheck => ({
  checkedAt: "2026-11-07T14:00:00.000Z",
  rate: "corrected",
  trueRate: 44100,
  measuredRate: 44097,
  level: "good",
  ...overrides,
});

const fastTrack = { id: "usb-1", label: "FastTrack Pro" };

describe("remembered microphone checks", () => {
  it("remembers the latest check of an input", () => {
    const { storage } = memoryStorage();
    rememberCheck(() => storage, fastTrack, check());
    expect(readCheck(() => storage, fastTrack)).toEqual(check());
  });

  it("replaces an input's earlier check and keeps the other inputs'", () => {
    const { storage } = memoryStorage();
    const builtIn = { id: "builtin", label: "MacBook Pro Microphone" };
    rememberCheck(() => storage, fastTrack, check());
    rememberCheck(() => storage, builtIn, check({ rate: "accurate", measuredRate: 47999 }));
    rememberCheck(() => storage, fastTrack, check({ rate: "mismatch", measuredRate: 42000 }));
    expect(readCheck(() => storage, fastTrack)).toMatchObject({ rate: "mismatch" });
    expect(readCheck(() => storage, builtIn)).toMatchObject({ rate: "accurate" });
  });

  it("finds an input by its name when its identifier changed", () => {
    const { storage } = memoryStorage();
    rememberCheck(() => storage, fastTrack, check());
    expect(readCheck(() => storage, { id: "usb-2", label: "FastTrack Pro" })).toEqual(check());
  });

  it("replaces the check found by name when the identifier changed", () => {
    const { storage, items } = memoryStorage();
    rememberCheck(() => storage, fastTrack, check());
    rememberCheck(
      () => storage,
      { id: "usb-2", label: "FastTrack Pro" },
      check({ rate: "accurate" }),
    );
    expect(JSON.parse(items.get(KEY) ?? "[]")).toHaveLength(1);
  });

  it("does not match unnamed inputs by name", () => {
    const { storage } = memoryStorage();
    rememberCheck(() => storage, { id: "a", label: null }, check());
    expect(readCheck(() => storage, { id: "b", label: null })).toBeNull();
  });

  it("has nothing for an input never checked", () => {
    expect(readCheck(() => memoryStorage().storage, fastTrack)).toBeNull();
  });

  it.each([
    ["not JSON", "{"],
    ["not a list", '{"usb-1": {}}'],
    [
      "an entry with a wrong verdict",
      JSON.stringify([{ id: "usb-1", label: null, ...check(), rate: "great" }]),
    ],
    [
      "an entry without a date",
      JSON.stringify([{ id: "usb-1", label: null, ...check(), checkedAt: 7 }]),
    ],
    [
      "an entry with a wrong level",
      JSON.stringify([{ id: "usb-1", label: null, ...check(), level: "loud" }]),
    ],
    [
      "an entry without a rate",
      JSON.stringify([{ id: "usb-1", label: null, ...check(), measuredRate: "x" }]),
    ],
    [
      "an entry with a text true rate",
      JSON.stringify([{ id: "usb-1", label: null, ...check(), trueRate: "44100" }]),
    ],
    ["an entry without an identifier", JSON.stringify([{ label: "FastTrack Pro", ...check() }])],
    ["a null entry", "[null]"],
  ])("reads %s as nothing remembered", (_, stored) => {
    const { storage } = memoryStorage({ [KEY]: stored });
    expect(readCheck(() => storage, fastTrack)).toBeNull();
  });

  it("keeps a check without a true rate", () => {
    const { storage } = memoryStorage();
    const { trueRate: _ignored, ...accurate } = check({ rate: "accurate" });
    rememberCheck(() => storage, fastTrack, accurate);
    const read = readCheck(() => storage, fastTrack);
    expect(read).toEqual(accurate);
    expect(read).not.toHaveProperty("trueRate");
  });

  it.each(["noTap", "clipping", "low", "good"] as const)("remembers the %s level", (level) => {
    const { storage } = memoryStorage();
    rememberCheck(() => storage, fastTrack, check({ level }));
    expect(readCheck(() => storage, fastTrack)).toMatchObject({ level });
  });

  it("finds an unnamed input by its identifier", () => {
    const { storage } = memoryStorage();
    rememberCheck(() => storage, { id: "a", label: null }, check());
    expect(readCheck(() => storage, { id: "a", label: null })).toEqual(check());
  });

  it("ignores an entry whose name is not text", () => {
    const stored = JSON.stringify([{ id: "usb-1", label: 7, ...check() }]);
    const { storage } = memoryStorage({ [KEY]: stored });
    expect(readCheck(() => storage, fastTrack)).toBeNull();
  });

  it("skips unreadable entries and keeps the valid ones", () => {
    const stored = JSON.stringify([null, 5, "x", { id: "usb-1", label: null, ...check() }]);
    const { storage } = memoryStorage({ [KEY]: stored });
    expect(readCheck(() => storage, fastTrack)).toEqual(check());
  });

  it.each([
    ["not JSON", "{"],
    ["not a list", '{"usb-1": {}}'],
  ])("replaces a stored value that is %s with the new check", (_, stored) => {
    const { storage, items } = memoryStorage({ [KEY]: stored });
    rememberCheck(() => storage, fastTrack, check());
    expect(JSON.parse(items.get(KEY) ?? "null")).toEqual([{ ...fastTrack, ...check() }]);
  });

  it("works without storage, remembering nothing", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    expect(() => rememberCheck(blocked, fastTrack, check())).not.toThrow();
    expect(readCheck(blocked, fastTrack)).toBeNull();
  });

  it("writes nothing when storage refuses to be read", () => {
    const { storage, items } = memoryStorage();
    const refusing: Storage = {
      ...storage,
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    rememberCheck(() => refusing, fastTrack, check());
    expect(items.size).toBe(0);
  });
});
