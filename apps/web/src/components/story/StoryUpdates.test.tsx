// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { STORY_TOKEN } from "./fixtures";
import { StoryUpdates } from "./StoryUpdates";

const STORED_KEY = `gb-story-updates:${STORY_TOKEN}`;

Object.assign(window, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

/** A browser's notification support: its permission, and the answer to a request. */
function browserNotifications({
  permission = "default" as NotificationPermission,
  answer = "granted" as NotificationPermission,
  supported = true,
} = {}) {
  const requestPermission = vi.fn(async () => answer);
  if (supported) {
    vi.stubGlobal("Notification", { permission, requestPermission });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: async () => ({}), ready: new Promise(() => {}) },
    });
  } else {
    vi.stubGlobal("Notification", undefined);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
  }
  return { requestPermission };
}

function renderUpdates(locale: TestLocale = "en") {
  const user = userEvent.setup({
    advanceTimers: (ms) => {
      if (vi.isFakeTimers()) vi.advanceTimersByTime(ms);
    },
  });
  const view = renderWithIntl(
    <AppProviders>
      <StoryUpdates token={STORY_TOKEN} onChange={onChange} />
    </AppProviders>,
    { locale },
  );
  return { user, ...view };
}

const onChange = vi.fn();
const updatesSwitch = () => screen.getByRole("switch");

async function waitForPrompt(ms = 2000) {
  await act(async () => vi.advanceTimersByTime(ms));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  onChange.mockReset();
});

describe("StoryUpdates prompt", () => {
  it("asks a first-time visitor about updates 2 seconds after the story opens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserNotifications();
    renderUpdates();
    await waitForPrompt(1900);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitForPrompt(100);
    expect(screen.getByRole("dialog", { name: "Get Build Updates?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(
      screen.getByText(
        "Would you like to be notified when new photos or notes are added to this build?",
      ),
    ).toBeTruthy();
  });

  it("turns updates on and remembers it when the visitor accepts and allows notifications", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { requestPermission } = browserNotifications({ answer: "granted" });
    const { user } = renderUpdates();
    await waitForPrompt();
    await user.click(screen.getByRole("button", { name: "Yes, notify me" }));
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(await screen.findByRole("switch", { name: "Updates On" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(updatesSwitch().getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(STORED_KEY)).toBe("on");
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("keeps updates off and remembers it when the browser permission is denied", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserNotifications({ answer: "denied" });
    const { user } = renderUpdates();
    await waitForPrompt();
    await user.click(screen.getByRole("button", { name: "Yes, notify me" }));
    await vi.waitFor(() => expect(localStorage.getItem(STORED_KEY)).toBe("off"));
    expect(screen.getByRole("switch", { name: "Get Updates" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("remembers No thanks and does not ask again for this link", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { requestPermission } = browserNotifications();
    const { user, unmount } = renderUpdates();
    await waitForPrompt();
    await user.click(screen.getByRole("button", { name: "No thanks" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(STORED_KEY)).toBe("off");
    expect(requestPermission).not.toHaveBeenCalled();
    unmount();
    renderUpdates();
    await waitForPrompt(5000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask once the visitor has decided on browser notifications", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserNotifications({ permission: "denied" });
    renderUpdates();
    await waitForPrompt(5000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask in a browser without notifications", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserNotifications({ supported: false });
    renderUpdates();
    await waitForPrompt(5000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("StoryUpdates switch", () => {
  it("reads Get Updates while updates are off", () => {
    browserNotifications();
    renderUpdates();
    expect(screen.getByRole("switch", { name: "Get Updates" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("asks for permission and turns updates on", async () => {
    const { requestPermission } = browserNotifications({ answer: "granted" });
    const { user } = renderUpdates();
    await user.click(updatesSwitch());
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(await screen.findByRole("switch", { name: "Updates On" })).toBeTruthy();
    expect(localStorage.getItem(STORED_KEY)).toBe("on");
  });

  it("stays off when the permission is refused", async () => {
    browserNotifications({ answer: "denied" });
    const { user } = renderUpdates();
    await user.click(updatesSwitch());
    await vi.waitFor(() => expect(localStorage.getItem(STORED_KEY)).toBe("off"));
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalledWith(true);
  });

  it("says so in a browser without notifications", async () => {
    browserNotifications({ supported: false });
    const { user } = renderUpdates();
    await user.click(updatesSwitch());
    expect(await screen.findByText("This browser does not support notifications.")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
  });

  it("turns updates off and keeps them off on the next visit", async () => {
    browserNotifications({ permission: "granted" });
    localStorage.setItem(STORED_KEY, "on");
    const { user, unmount } = renderUpdates();
    expect(await screen.findByRole("switch", { name: "Updates On" })).toBeTruthy();
    await user.click(updatesSwitch());
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
    expect(localStorage.getItem(STORED_KEY)).toBe("off");
    expect(onChange).toHaveBeenLastCalledWith(false);
    unmount();
    renderUpdates();
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
  });

  it("restores updates on a later visit only while notifications are still allowed", async () => {
    browserNotifications({ permission: "denied" });
    localStorage.setItem(STORED_KEY, "on");
    const { unmount } = renderUpdates();
    expect(screen.getByRole("switch", { name: "Get Updates" })).toBeTruthy();
    unmount();
    browserNotifications({ permission: "granted" });
    renderUpdates();
    expect(await screen.findByRole("switch", { name: "Updates On" })).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("is in French", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    browserNotifications();
    renderUpdates("fr");
    expect(screen.getByRole("switch", { name: "Recevoir les mises à jour" })).toBeTruthy();
    await waitForPrompt();
    expect(
      screen.getByRole("dialog", { name: "Recevoir les mises à jour de la fabrication ?" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oui, m’avertir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Non merci" })).toBeTruthy();
  });
});
