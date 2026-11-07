// build-story-sharing: Story Update Prompt, Story Notification Switch, Story Update
// Notifications.
import { describe, expect, it } from "vitest";
import {
  readUpdatesPreference,
  restoresUpdates,
  shouldNotify,
  shouldPrompt,
  writeUpdatesPreference,
} from "./updates";

const TOKEN = "dddddddd-0000-4000-8000-00000000000d";

function memoryStorage(entries: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(entries));
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => items.clear(),
  };
}

const blocked = (): Storage => {
  throw new Error("SecurityError");
};

describe("shouldNotify", () => {
  it("notifies when the timeline gains a step", () => {
    expect(shouldNotify(4, 5)).toBe(true);
  });

  it("does not notify when the number of timeline steps stays the same or drops", () => {
    expect(shouldNotify(5, 5)).toBe(false);
    expect(shouldNotify(5, 4)).toBe(false);
  });
});

describe("shouldPrompt", () => {
  it("asks a first-time visitor whose browser supports notifications", () => {
    expect(shouldPrompt({ supported: true, permission: "default", stored: null })).toBe(true);
  });

  it("does not ask when the browser lacks notifications", () => {
    expect(shouldPrompt({ supported: false, permission: "default", stored: null })).toBe(false);
  });

  it("does not ask once the visitor has decided on browser notifications", () => {
    expect(shouldPrompt({ supported: true, permission: "granted", stored: null })).toBe(false);
    expect(shouldPrompt({ supported: true, permission: "denied", stored: null })).toBe(false);
  });

  it("does not ask when a preference is remembered for this link", () => {
    expect(shouldPrompt({ supported: true, permission: "default", stored: "off" })).toBe(false);
    expect(shouldPrompt({ supported: true, permission: "default", stored: "on" })).toBe(false);
  });
});

describe("restoresUpdates", () => {
  it("turns updates back on when they were on and permission is still granted", () => {
    expect(restoresUpdates({ stored: "on", permission: "granted" })).toBe(true);
  });

  it("leaves updates off otherwise", () => {
    expect(restoresUpdates({ stored: "on", permission: "denied" })).toBe(false);
    expect(restoresUpdates({ stored: "on", permission: "default" })).toBe(false);
    expect(restoresUpdates({ stored: "on", permission: null })).toBe(false);
    expect(restoresUpdates({ stored: "off", permission: "granted" })).toBe(false);
    expect(restoresUpdates({ stored: null, permission: "granted" })).toBe(false);
  });
});

describe("updates preference", () => {
  it("remembers the preference per story link", () => {
    const storage = memoryStorage();
    writeUpdatesPreference(() => storage, TOKEN, "on");
    expect(storage.getItem(`gb-story-updates:${TOKEN}`)).toBe("on");
    expect(readUpdatesPreference(() => storage, TOKEN)).toBe("on");
    expect(readUpdatesPreference(() => storage, "another-token")).toBeNull();
    writeUpdatesPreference(() => storage, TOKEN, "off");
    expect(readUpdatesPreference(() => storage, TOKEN)).toBe("off");
  });

  it("reads an unknown value as no preference", () => {
    const storage = memoryStorage({ [`gb-story-updates:${TOKEN}`]: "true" });
    expect(readUpdatesPreference(() => storage, TOKEN)).toBeNull();
  });

  it("works without storage", () => {
    expect(readUpdatesPreference(blocked, TOKEN)).toBeNull();
    expect(() => writeUpdatesPreference(blocked, TOKEN, "on")).not.toThrow();
  });
});
