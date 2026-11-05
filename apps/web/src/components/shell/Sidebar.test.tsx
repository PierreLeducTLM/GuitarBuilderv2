// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/intl";
import { Sidebar } from "./Sidebar";

type Props = ComponentProps<typeof Sidebar>;

const renderSidebar = (props: Partial<Props> = {}, locale?: "en" | "fr") =>
  renderWithIntl(
    <Sidebar
      pathname="/builds"
      role="user"
      email="luthier@example.com"
      recentBuilds={<p>recent builds slot</p>}
      {...props}
    />,
    { locale },
  );

const sidebar = () => screen.getByRole("complementary");
const links = () =>
  within(sidebar())
    .getAllByRole("link")
    .map((link) => [
      link.getAttribute("aria-label") ?? link.textContent,
      link.getAttribute("href"),
    ]);

describe("Sidebar", () => {
  it("lists title, Builds, Tools with its sections, Assistant, the admin entries and the account, in order", () => {
    renderSidebar({ role: "admin" });
    expect(links()).toEqual([
      ["Guitar Builder", "/builds"],
      ["Builds", "/builds"],
      ["Tools", "/tools"],
      ["Wood panels", "/wood-properties"],
      ["Simulator", "/simulator"],
      ["Assistant", "/chat"],
      ["References", "/references"],
      ["Admin", "/admin"],
      ["luthier@example.com", "/you"],
    ]);
  });

  it("names its navigation landmark", () => {
    renderSidebar();
    expect(within(sidebar()).getByRole("navigation", { name: "Navigation" })).toBeTruthy();
  });

  it("puts the recent builds under Builds and before Tools", () => {
    renderSidebar();
    const slot = screen.getByText("recent builds slot");
    const builds = screen.getByRole("link", { name: "Builds" });
    const tools = screen.getByRole("link", { name: "Tools" });
    expect(builds.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no admin entries to a regular user", () => {
    renderSidebar({ role: "user" });
    expect(screen.queryByRole("link", { name: "References" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });

  it("marks the admin entries for their accent and leaves the others unmarked", () => {
    renderSidebar({ role: "admin" });
    expect(screen.getByRole("link", { name: "References" }).dataset.admin).toBe("true");
    expect(screen.getByRole("link", { name: "Admin" }).dataset.admin).toBe("true");
    expect(screen.getByRole("link", { name: "Assistant" }).dataset.admin).toBeUndefined();
  });

  it.each([
    ["/builds/7f3c/steps/TopPanel", "Builds"],
    ["/tools", "Tools"],
    ["/wood-properties", "Wood panels"],
    ["/simulator", "Simulator"],
    ["/chat", "Assistant"],
    ["/references", "References"],
    ["/admin", "Admin"],
    ["/you", "luthier@example.com"],
  ])("on %s highlights only %s", (pathname, entry) => {
    renderSidebar({ pathname, role: "admin" });
    const current = within(sidebar())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.getAttribute("aria-label") ?? link.textContent)).toEqual([
      entry,
    ]);
  });

  it("groups the admin entries under Administration, for administrators only", () => {
    renderSidebar({ role: "admin" });
    const group = screen.getByRole("group", { name: "Administration" });
    expect(
      within(group)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["References", "Admin"]);
  });

  it("has no Administration group for a regular user", () => {
    renderSidebar({ role: "user" });
    expect(screen.queryByRole("group", { name: "Administration" })).toBeNull();
  });

  it("describes the account entry as the account", () => {
    renderSidebar();
    expect(screen.getByRole("link", { name: "luthier@example.com" }).title).toBe("Account");
  });

  it("is labelled in French", () => {
    renderSidebar({ pathname: "/tools" }, "fr");
    expect(screen.getByRole("link", { name: "Outils" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Panneaux de bois" }).getAttribute("href")).toBe(
      "/wood-properties",
    );
    expect(screen.getByRole("link", { name: "Constructeur de Guitare" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "luthier@example.com" }).title).toBe("Compte");
  });
});
