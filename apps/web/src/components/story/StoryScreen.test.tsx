// @vitest-environment jsdom
// build-story-sharing: Live Story Updates and Story Update Notifications, through the
// story page with a fake Realtime channel and a fake service worker.
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { displayGraph } from "@/lib/sequence/variant";
import { parseStory } from "@/lib/story/story";
import { renderWithIntl } from "@/test/intl";
import { STORY_TOKEN } from "./fixtures";
import { StoryScreen } from "./StoryScreen";

Object.assign(window, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

const ORDER = displayGraph({ guitarType: "steel_string", boboNeck: true }).steps.map(
  (step) => step.key,
);

/** get_build_story's answer for a build whose first `documented` steps have notes. */
function storedStory(documented: number, notes = "Done.") {
  return {
    name: "OM #3",
    guitarType: "steel_string",
    boboNeck: true,
    createdAt: "2025-12-06T15:30:00Z",
    steps: ORDER.slice(0, documented).map((key) => ({ key, completed: true, notes })),
  };
}

function initialStory(documented: number) {
  const story = parseStory(storedStory(documented));
  if (!story) throw new Error("unreadable story");
  return story;
}

/** A browser Supabase client with a Realtime channel the test can signal. */
const realtime = vi.hoisted(() => ({
  answers: [] as unknown[],
  rpcCalls: 0,
  channels: [] as { topic: string; options: unknown; listener?: () => void; removed: boolean }[],
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: () => {
      realtime.rpcCalls += 1;
      return Promise.resolve({ data: realtime.answers.shift() ?? null, error: null });
    },
    channel: (topic: string, options: unknown) => {
      const entry: (typeof realtime.channels)[number] = { topic, options, removed: false };
      realtime.channels.push(entry);
      const channel = {
        on: (type: string, filter: { event: string }, listener: () => void) => {
          if (type === "broadcast" && filter.event === "changed") entry.listener = listener;
          return channel;
        },
        subscribe: () => channel,
        entry,
      };
      return channel;
    },
    removeChannel: (channel: { entry: { removed: boolean } }) => {
      channel.entry.removed = true;
      return Promise.resolve("ok");
    },
  }),
}));

/** Notification permission, the remembered choice, and a fake story worker. */
function updatesOn({
  remembered = true,
  permission = "granted" as NotificationPermission,
  registers = true,
} = {}) {
  vi.stubGlobal("Notification", { permission, requestPermission: vi.fn() });
  if (remembered) localStorage.setItem(`gb-story-updates:${STORY_TOKEN}`, "on");
  const showNotification = vi.fn(() => Promise.resolve());
  const listeners = new Set<{ type: string; listener: (event: { data: unknown }) => void }>();
  const register = vi.fn(() =>
    registers ? Promise.resolve({}) : Promise.reject(new Error("SecurityError")),
  );
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register,
      ready: Promise.resolve({ showNotification }),
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) =>
        listeners.add({ type, listener }),
      removeEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        for (const entry of listeners) {
          if (entry.type === type && entry.listener === listener) listeners.delete(entry);
        }
      },
    },
  });
  const post = (data: unknown) => {
    for (const entry of listeners) if (entry.type === "message") entry.listener({ data });
  };
  return {
    showNotification,
    register,
    listening: () => listeners.size,
    post,
    click: () => post({ type: "story-notification-click" }),
  };
}

function renderScreen(documented = 4) {
  return renderWithIntl(
    <AppProviders>
      <StoryScreen token={STORY_TOKEN} initial={initialStory(documented)} />
    </AppProviders>,
  );
}

const channel = () => realtime.channels.at(-1);

async function signal(times = 1) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) channel()?.listener?.();
  });
}

async function wait(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  realtime.answers = [];
  realtime.rpcCalls = 0;
  realtime.channels = [];
});

describe("StoryScreen live updates", () => {
  it("does not follow the build or register the worker while updates are off", async () => {
    const worker = updatesOn({ remembered: false, permission: "default" });
    renderScreen();
    await act(async () => {});
    expect(realtime.channels).toEqual([]);
    expect(worker.register).not.toHaveBeenCalled();
  });

  it("follows the build on its private story topic while updates are on", async () => {
    updatesOn();
    renderScreen();
    await act(async () => {});
    expect(channel()).toMatchObject({
      topic: `story:${STORY_TOKEN}`,
      options: { config: { private: true } },
      removed: false,
    });
  });

  it("fetches the story once for a burst of changes within a second", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    updatesOn();
    realtime.answers = [storedStory(5)];
    renderScreen();
    await wait(0);
    await signal(3);
    await wait(900);
    expect(realtime.rpcCalls).toBe(0);
    await wait(100);
    expect(realtime.rpcCalls).toBe(1);
    expect(screen.getAllByText("Step 5")).toHaveLength(1);
  });

  it("notifies when the timeline gains a step", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const worker = updatesOn();
    realtime.answers = [storedStory(5)];
    renderScreen(4);
    await wait(0);
    await signal();
    await wait(1000);
    expect(worker.showNotification).toHaveBeenCalledExactlyOnceWith("Update: OM #3", {
      body: "New progress has been posted! Click to see.",
      tag: `story-${STORY_TOKEN}`,
      data: { url: window.location.href },
    });
  });

  it("refreshes an edited step without notifying", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const worker = updatesOn();
    realtime.answers = [storedStory(4, "Reworked.")];
    renderScreen(4);
    await wait(0);
    await signal();
    await wait(1000);
    expect(screen.getAllByText("Reworked.")).toHaveLength(4);
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it("notifies again only when the timeline grows past what was last shown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const worker = updatesOn();
    realtime.answers = [storedStory(5), storedStory(5, "Edited."), storedStory(6)];
    renderScreen(4);
    await wait(0);
    for (const _ of [1, 2, 3]) {
      await signal();
      await wait(1000);
    }
    expect(worker.showNotification).toHaveBeenCalledTimes(2);
  });

  it("scrolls to the last step when the visitor clicks a notification", async () => {
    const worker = updatesOn();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderScreen(4);
    await act(async () => {
      worker.post(null);
      worker.post({ type: "something-else" });
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
    await act(async () => worker.click());
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth" });
    const scrolled = scrollIntoView.mock.contexts[0] as Element;
    expect(scrolled.textContent).toContain("Step 4");
  });

  it("works in a browser without service workers or notifications", () => {
    vi.stubGlobal("Notification", undefined);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
    renderScreen(4);
    expect(screen.getByRole("heading", { level: 1, name: "OM #3" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
  });

  it("ignores a notification click while the timeline is empty", async () => {
    const worker = updatesOn();
    renderScreen(0);
    await act(async () => worker.click());
    expect(screen.getByRole("heading", { name: "Build Just Started" })).toBeTruthy();
  });

  it("keeps refreshing when notifications cannot be shown", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const worker = updatesOn({ registers: false });
    realtime.answers = [storedStory(5)];
    renderScreen(4);
    await wait(0);
    await signal();
    await wait(1000);
    expect(screen.getByText("Step 5")).toBeTruthy();
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it("shows Story Not Found once the link stops working", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    updatesOn();
    realtime.answers = [null];
    renderScreen();
    await wait(0);
    await signal();
    await wait(1000);
    expect(screen.getByRole("heading", { level: 1, name: "Story Not Found" })).toBeTruthy();
  });

  it("stops following when the page closes, dropping a refresh still waiting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const worker = updatesOn();
    const { unmount } = renderScreen();
    await wait(0);
    expect(worker.listening()).toBe(1);
    await signal();
    unmount();
    await wait(2000);
    expect(channel()?.removed).toBe(true);
    expect(realtime.rpcCalls).toBe(0);
    expect(worker.listening()).toBe(0);
  });
});
