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

function renderYou(role: "user" | "admin", locale: TestLocale = "en") {
  return renderWithIntl(
    <AppProviders>
      <YouScreen email="luthier@example.com" role={role} />
    </AppProviders>,
    { locale },
  );
}

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
    expect(screen.queryByRole("group", { name: "Administration" })).toBeNull();
  });

  it("gives an administrator References and Admin under Administration, above Sign Out", () => {
    renderYou("admin");
    const group = screen.getByRole("group", { name: "Administration" });
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
    renderYou("admin", "fr");
    expect(screen.getByRole("heading", { level: 1, name: "Vous" })).toBeTruthy();
    expect(screen.getByText("Connecté en tant que")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Administration" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déconnexion" })).toBeTruthy();
  });
});
