// build-story-sharing: Story Update Notifications. The story's service worker only shows
// notifications and brings the story forward when one is clicked.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import {
  notificationsSupported,
  registerStoryWorker,
  STORY_WORKER_SCOPE,
  STORY_WORKER_URL,
} from "./worker";

const STORY_URL = "https://guitar.example/story/dddddddd-0000-4000-8000-00000000000d";

describe("notificationsSupported", () => {
  it("needs both page notifications and service workers", () => {
    const pageNotifications = { Notification: {} };
    expect(notificationsSupported({ ...pageNotifications, navigator: { serviceWorker: {} } })).toBe(
      true,
    );
    expect(notificationsSupported({ navigator: { serviceWorker: {} } })).toBe(false);
    expect(notificationsSupported({ ...pageNotifications, navigator: {} })).toBe(false);
  });
});

describe("registerStoryWorker", () => {
  it("registers the story worker for story pages and waits until it is ready", async () => {
    const registration = { scope: "https://guitar.example/story/" };
    const register = vi.fn(() => Promise.resolve(registration));
    expect(await registerStoryWorker({ register, ready: Promise.resolve(registration) })).toBe(
      registration,
    );
    expect(register).toHaveBeenCalledWith(STORY_WORKER_URL, { scope: STORY_WORKER_SCOPE });
    expect([STORY_WORKER_URL, STORY_WORKER_SCOPE]).toEqual(["/story/sw.js", "/story/"]);
  });

  it("gives nothing without service workers or when registration fails", async () => {
    expect(await registerStoryWorker(undefined)).toBeNull();
    const register = () => Promise.reject(new Error("SecurityError"));
    expect(await registerStoryWorker({ register, ready: new Promise(() => {}) })).toBeNull();
  });
});

type Listener = (event: unknown) => void;

/** Runs public/story/sw.js against a fake worker global and returns its listeners. */
function loadWorker(windows: { url: string }[]) {
  const listeners = new Map<string, Listener>();
  const openWindow = vi.fn(() => Promise.resolve(null));
  const clients = { matchAll: vi.fn(() => Promise.resolve(windows)), openWindow };
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../public/story/sw.js"),
    "utf8",
  );
  runInNewContext(source, {
    URL,
    self: {
      clients,
      addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    },
  });
  return { listeners, clients, openWindow };
}

function click(listener: Listener | undefined, url: string | undefined) {
  const close = vi.fn();
  let work: Promise<unknown> = Promise.resolve();
  listener?.({
    notification: { close, data: url === undefined ? undefined : { url } },
    waitUntil: (promise: Promise<unknown>) => {
      work = promise;
    },
  });
  return { close, done: () => work };
}

function storyWindow(url: string) {
  return { url, focus: vi.fn(() => Promise.resolve()), postMessage: vi.fn() };
}

describe("the story service worker", () => {
  it("handles notification clicks and nothing else: no fetch handler, no cache", () => {
    expect([...loadWorker([]).listeners.keys()]).toEqual(["notificationclick"]);
  });

  it("brings the open story forward and asks it to show the latest step", async () => {
    const other = storyWindow("https://guitar.example/story/eeeeeeee-0000-4000-8000-00000000000e");
    const story = storyWindow(`${STORY_URL}#top`);
    const worker = loadWorker([other, story]);
    const clicked = click(worker.listeners.get("notificationclick"), STORY_URL);
    await clicked.done();
    expect(clicked.close).toHaveBeenCalledOnce();
    expect(worker.clients.matchAll).toHaveBeenCalledWith({
      type: "window",
      includeUncontrolled: true,
    });
    expect(story.focus).toHaveBeenCalledOnce();
    expect(story.postMessage).toHaveBeenCalledWith({ type: "story-notification-click" });
    expect(other.focus).not.toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens the story when it is no longer open", async () => {
    const worker = loadWorker([]);
    await click(worker.listeners.get("notificationclick"), STORY_URL).done();
    expect(worker.openWindow).toHaveBeenCalledWith(STORY_URL);
  });

  it("only closes a notification that names no story", async () => {
    const worker = loadWorker([]);
    const clicked = click(worker.listeners.get("notificationclick"), undefined);
    await clicked.done();
    expect(clicked.close).toHaveBeenCalledOnce();
    expect(worker.clients.matchAll).not.toHaveBeenCalled();
  });
});
