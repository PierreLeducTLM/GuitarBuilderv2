// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/components/AppProviders";
import { renderWithIntl, type TestLocale } from "@/test/intl";
import { YouScreen } from "./YouScreen";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const signOut = vi.hoisted(() => ({ result: { ok: true } }));
vi.mock("@/lib/auth/signOut", () => ({ signOutThisBrowser: async () => signOut.result }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

Object.assign(window, {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});

function renderYou(
  role: "user" | "admin",
  { locale = "en", canSignOut = true }: { locale?: TestLocale; canSignOut?: boolean } = {},
) {
  return renderWithIntl(
    <AppProviders>
      <YouScreen email="luthier@example.com" role={role} canSignOut={canSignOut} />
    </AppProviders>,
    { locale },
  );
}

describe("YouScreen microphone", () => {
  it("opens the Microphone Check from the Microphone group", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      mediaDevices: {
        enumerateDevices: async () => [],
        getUserMedia: vi.fn(),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
    renderYou("user");
    const group = screen.getByRole("region", { name: "Microphone" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(within(group).getByRole("button", { name: "Check microphone" }));
    const check = screen.getByRole("dialog", { name: "Microphone Check" });
    await userEvent.click(within(check).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("is in French", () => {
    renderYou("user", { locale: "fr" });
    const group = screen.getByRole("region", { name: "Micro" });
    expect(within(group).getByRole("button", { name: "Vérifier le micro" })).toBeTruthy();
  });
});

describe("YouScreen", () => {
  it("shows who is signed in, the preferences and Sign Out to a regular user", () => {
    renderYou("user");
    expect(screen.getByRole("heading", { level: 1, name: "You" })).toBeTruthy();
    expect(screen.getByText("Signed in as")).toBeTruthy();
    expect(screen.getByText("luthier@example.com")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Preferences" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Administration" })).toBeNull();
  });

  it("gives an administrator References and Admin under Administration, above Sign Out", () => {
    renderYou("admin");
    const group = screen.getByRole("region", { name: "Administration" });
    const links = within(group).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["References", "/references"],
      ["Admin", "/admin"],
    ]);
    expect(links.every((link) => link.dataset.admin === "true")).toBe(true);
    const signOutButton = screen.getByRole("button", { name: "Sign Out" });
    expect(
      group.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("offers no Sign Out while every visitor shares one account", () => {
    renderYou("admin", { canSignOut: false });
    expect(screen.getByText("luthier@example.com")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Administration" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign Out" })).toBeNull();
  });

  it("signs out and shows the sign-in screen", async () => {
    signOut.result = { ok: true };
    renderYou("user");
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(router.replace).toHaveBeenCalledWith("/sign-in");
  });

  it("says so and stays when signing out fails", async () => {
    signOut.result = { ok: false };
    router.replace.mockClear();
    renderYou("user");
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(await screen.findByText("Failed to sign out")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Sign Out" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("is in French", () => {
    renderYou("admin", { locale: "fr" });
    expect(screen.getByRole("heading", { level: 1, name: "Vous" })).toBeTruthy();
    expect(screen.getByText("Connecté en tant que")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Administration" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déconnexion" })).toBeTruthy();
  });
});
