// @vitest-environment jsdom
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import type { ShareResult } from "@/lib/builds/sharing";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { ShareDialog } from "./ShareDialog";

const TOKEN = "dddddddd-0000-4000-8000-00000000000d";

/** A controllable stand-in for the sharing requests. */
const sharing = vi.hoisted(() => ({
  read: vi.fn<(buildId: string) => Promise<ShareResult>>(),
  set: vi.fn<(buildId: string, enabled: boolean) => Promise<ShareResult>>(),
}));
vi.mock("@/lib/builds/sharing", () => ({
  readShareToken: (buildId: string) => sharing.read(buildId),
  setSharing: (buildId: string, enabled: boolean) => sharing.set(buildId, enabled),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

Object.assign(window, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function ShareHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open share
      </button>
      <ShareDialog buildId="build-1" buildName="OM #3" open={open} onOpenChange={setOpen} />
    </>
  );
}

function setup({
  stored = { ok: true, token: null } as ShareResult,
  locale = "en" as TestLocale,
  user = userEvent.setup(),
} = {}) {
  sharing.read.mockReset().mockResolvedValue(stored);
  sharing.set.mockReset();
  renderWithIntl(
    <AppProviders>
      <ShareHarness />
    </AppProviders>,
    { locale },
  );
  return user;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "open share" }));
  const control = await screen.findByRole("switch", { name: "Public Access" });
  await waitFor(() => expect(control.hasAttribute("disabled")).toBe(false));
  return control;
}

const storyLink = (token: string) => `${window.location.origin}/story/${token}`;

describe("ShareDialog", () => {
  it("shows an unshared build as private, with no link", async () => {
    const user = setup();
    const control = await openDialog(user);
    expect(screen.getByRole("dialog", { name: "Share Build Story" })).toBeTruthy();
    expect(screen.getByText("OM #3")).toBeTruthy();
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Only you can see this build")).toBeTruthy();
    expect(screen.getByText("Sharing is disabled")).toBeTruthy();
    expect(screen.getByText("Enable public access to generate a shareable link")).toBeTruthy();
    expect(screen.queryByLabelText("Share Link")).toBeNull();
    expect(screen.queryByText("Failed to load the sharing settings")).toBeNull();
    expect(sharing.read).toHaveBeenCalledWith("build-1");
  });

  it("does not share the build by being opened and closed", async () => {
    const user = setup();
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sharing.set).not.toHaveBeenCalled();
  });

  it("reads the stored state again each time it opens", async () => {
    const user = setup({ stored: { ok: true, token: TOKEN } });
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "Done" }));
    await openDialog(user);
    expect(sharing.read).toHaveBeenCalledTimes(2);
    expect((screen.getByLabelText("Share Link") as HTMLInputElement).value).toBe(storyLink(TOKEN));
  });

  it("keeps the switch disabled until the stored state is known", async () => {
    const user = setup();
    const answer = deferred<ShareResult>();
    sharing.read.mockReturnValue(answer.promise);
    await user.click(screen.getByRole("button", { name: "open share" }));
    const control = screen.getByRole("switch", { name: "Public Access" });
    expect(control.hasAttribute("disabled")).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByText("Sharing is disabled")).toBeNull();
    expect(screen.queryByLabelText("Share Link")).toBeNull();
    await act(async () => answer.resolve({ ok: true, token: TOKEN }));
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("says when the stored state cannot be read", async () => {
    const user = setup({ stored: { ok: false } });
    await user.click(screen.getByRole("button", { name: "open share" }));
    expect(await screen.findByText("Failed to load the sharing settings")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Public Access" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.queryByText("Sharing is disabled")).toBeNull();
  });

  it("turns sharing on and shows the link, the actions and the tip", async () => {
    const user = setup();
    const control = await openDialog(user);
    const answer = deferred<ShareResult>();
    sharing.set.mockReturnValue(answer.promise);
    await user.click(control);
    expect(sharing.set).toHaveBeenCalledWith("build-1", true);
    expect(control.hasAttribute("disabled")).toBe(true);
    await act(async () => answer.resolve({ ok: true, token: TOKEN }));
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Anyone with the link can view")).toBeTruthy();
    const field = screen.getByLabelText("Share Link") as HTMLInputElement;
    expect(field.value).toBe(storyLink(TOKEN));
    expect(field.readOnly).toBe(true);
    await user.click(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, field.value.length]);
    const preview = screen.getByRole("link", { name: "Preview Build Story" });
    expect(preview.getAttribute("href")).toBe(storyLink(TOKEN));
    expect(preview.getAttribute("target")).toBe("_blank");
    expect(preview.getAttribute("rel")).toContain("noopener");
    expect(
      screen.getByText(
        "Share this link with your clients so they can follow along with your build progress. They'll see all completed steps, notes, and photos.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Sharing is disabled")).toBeNull();
  });

  it("stays private when sharing cannot be turned on", async () => {
    const user = setup();
    const control = await openDialog(user);
    sharing.set.mockResolvedValue({ ok: false });
    await user.click(control);
    expect(await screen.findByText("Failed to enable sharing")).toBeTruthy();
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByLabelText("Share Link")).toBeNull();
  });

  it("turns sharing off and removes the link", async () => {
    const user = setup({ stored: { ok: true, token: TOKEN } });
    const control = await openDialog(user);
    sharing.set.mockResolvedValue({ ok: true, token: null });
    await user.click(control);
    expect(sharing.set).toHaveBeenCalledWith("build-1", false);
    await waitFor(() => expect(control.getAttribute("aria-checked")).toBe("false"));
    expect(screen.queryByLabelText("Share Link")).toBeNull();
    expect(screen.getByText("Sharing is disabled")).toBeTruthy();
  });

  it("stays shared when sharing cannot be turned off", async () => {
    const user = setup({ stored: { ok: true, token: TOKEN } });
    const control = await openDialog(user);
    sharing.set.mockResolvedValue({ ok: false });
    await user.click(control);
    expect(await screen.findByText("Failed to disable sharing")).toBeTruthy();
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Share Link") as HTMLInputElement).value).toBe(storyLink(TOKEN));
  });

  it("copies the link and confirms it for 2 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = setup({
        stored: { ok: true, token: TOKEN },
        user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }),
      });
      await openDialog(user);
      await user.click(screen.getByRole("button", { name: "Copy" }));
      expect(await navigator.clipboard.readText()).toBe(storyLink(TOKEN));
      expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(1900));
      expect(screen.getByRole("button", { name: "Copied!" })).toBeTruthy();
      await act(async () => vi.advanceTimersByTime(100));
      expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is in French", async () => {
    const user = setup({ stored: { ok: true, token: TOKEN }, locale: "fr" });
    await user.click(screen.getByRole("button", { name: "open share" }));
    const control = await screen.findByRole("switch", { name: "Accès public" });
    await waitFor(() => expect(control.hasAttribute("disabled")).toBe(false));
    expect(
      screen.getByRole("dialog", { name: "Partager l’histoire de la fabrication" }),
    ).toBeTruthy();
    expect(screen.getByText("Toute personne disposant du lien peut voir")).toBeTruthy();
    expect(screen.getByLabelText("Lien de partage")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copier" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Aperçu de l’histoire de la fabrication" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminé" })).toBeTruthy();
  });
});
