import { describe, expect, it } from "vitest";
import {
  activeEntry,
  activeTab,
  adminEntriesFor,
  classifyPath,
  destinations,
  isActive,
  safeNextPath,
  sectionsFor,
  signInUrl,
} from "./routes";

describe("destinations", () => {
  it("are Builds, Tools, Assistant and You, in that order, with their URLs", () => {
    expect(destinations.map((d) => [d.id, d.href])).toEqual([
      ["builds", "/builds"],
      ["tools", "/tools"],
      ["assistant", "/chat"],
      ["you", "/you"],
    ]);
  });

  it("put Wood panels then Simulator under Tools, and nothing under the others", () => {
    expect(destinations.map((d) => d.sections.map((s) => [s.id, s.href]))).toEqual([
      [],
      [
        ["woodPanels", "/wood-properties"],
        ["simulator", "/simulator"],
      ],
      [],
      [],
    ]);
  });
});

describe("adminEntriesFor", () => {
  it("gives administrators References then Admin", () => {
    expect(adminEntriesFor("admin").map((e) => [e.id, e.href])).toEqual([
      ["references", "/references"],
      ["admin", "/admin"],
    ]);
  });

  it("gives users, and visitors whose role is not known yet, nothing", () => {
    expect(adminEntriesFor("user")).toEqual([]);
    expect(adminEntriesFor(null)).toEqual([]);
  });
});

describe("activeTab", () => {
  it.each([
    ["/builds", "builds"],
    ["/builds/7f3c-example/steps/TopPanel", "builds"],
    ["/tools", "tools"],
    ["/wood-properties", "tools"],
    ["/simulator", "tools"],
    ["/chat", "assistant"],
    ["/you", "you"],
  ])("%s makes %s the active tab", (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });

  it.each(["/references", "/admin", "/builds-archive", "/toolshed"])(
    "%s activates no tab",
    (path) => {
      expect(activeTab(path)).toBeNull();
    },
  );
});

describe("activeEntry", () => {
  it.each([
    ["/builds/7f3c-example/steps/TopPanel", "builds"],
    ["/tools", "tools"],
    ["/wood-properties", "woodPanels"],
    ["/simulator/run", "simulator"],
    ["/chat", "assistant"],
    ["/you", "you"],
    ["/references", "references"],
    ["/admin", "admin"],
  ])("%s makes %s the active sidebar entry", (path, entry) => {
    expect(activeEntry(path)).toBe(entry);
  });

  it("is null outside every entry", () => {
    expect(activeEntry("/story/abc")).toBeNull();
  });
});

describe("sectionsFor", () => {
  it("lists the four regular sections for users and while the role is unknown", () => {
    const ids = ["builds", "chat", "simulator", "woodProperties"];
    expect(sectionsFor("user").map((s) => s.id)).toEqual(ids);
    expect(sectionsFor(null).map((s) => s.id)).toEqual(ids);
  });

  it("adds References and Admin, in that order, for administrators", () => {
    expect(sectionsFor("admin").map((s) => s.href)).toEqual([
      "/builds",
      "/chat",
      "/simulator",
      "/wood-properties",
      "/references",
      "/admin",
    ]);
  });
});

describe("isActive", () => {
  it("highlights the entry whose URL prefix matches", () => {
    expect(isActive("/builds/7f3c-example", "/builds")).toBe(true);
    expect(isActive("/builds", "/builds")).toBe(true);
    expect(isActive("/builds-archive", "/builds")).toBe(false);
    expect(isActive("/chat", "/builds")).toBe(false);
  });
});

describe("classifyPath", () => {
  it.each([
    ["/", "root"],
    ["/builds", "section"],
    ["/builds/", "section"],
    ["/builds/7f3c-example", "section"],
    ["/builds/7f3c-example/map", "section"],
    ["/builds/7f3c-example/map/truss-rod", "section"],
    ["/builds/7f3c-example/overview", "section"],
    ["/builds/7f3c-example/steps/TopPanel", "section"],
    ["/builds/7f3c-example/steps/CLGlueBOBO1/", "section"],
    ["/tools", "section"],
    ["/tools//", "section"],
    ["/you", "section"],
    ["/chat", "section"],
    ["/simulator", "section"],
    ["/wood-properties", "section"],
    ["/references", "adminSection"],
    ["/admin", "adminSection"],
    ["/story/abc123", "story"],
    ["/sign-in", "signIn"],
    ["/auth/confirm", "authCallback"],
    ["/does-not-exist", "unknown"],
    ["/builds/a/b", "unknown"],
    ["/builds/x/extra", "unknown"],
    ["/builds/x/steps", "unknown"],
    ["/builds/x/steps/a b", "unknown"],
    ["/builds/x/steps/Top-Panel", "unknown"],
    ["/builds/x/steps/A/B", "unknown"],
    ["/builds/x/map/UPPER", "unknown"],
    ["/builds/x/map/truss_rod", "unknown"],
    ["/builds/x/map/a/b", "unknown"],
    ["/builds/x/overview/more", "unknown"],
    ["/x/builds", "unknown"],
    ["/x/story/abc", "unknown"],
    ["/tools/wood", "unknown"],
    ["/you/settings", "unknown"],
    ["/admin/users", "unknown"],
    ["/story", "unknown"],
    ["/story/a/b", "unknown"],
  ])("%s is %s", (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site with their query", () => {
    expect(safeNextPath("/chat")).toBe("/chat");
    expect(safeNextPath("/references?doc=12")).toBe("/references?doc=12");
    expect(safeNextPath("/builds/7f3c")).toBe("/builds/7f3c");
    expect(safeNextPath("/builds/x/steps/TopPanel")).toBe("/builds/x/steps/TopPanel");
    expect(safeNextPath("/builds/x/map/top-panel?from=map")).toBe(
      "/builds/x/map/top-panel?from=map",
    );
  });

  it.each([
    null,
    undefined,
    "",
    "chat",
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "/sign-in",
    "/sign-in?next=/chat",
    "/auth/confirm?code=1",
    "/chat\nSet-Cookie: x",
  ])("replaces %j with /builds", (value) => {
    expect(safeNextPath(value)).toBe("/builds");
  });
});

describe("safeNextPath encoded tricks", () => {
  it("keeps percent-encoded paths on this site, where they are just unknown routes", () => {
    const next = safeNextPath("/%0a//evil.example");
    expect(new URL(next, "https://app.example").origin).toBe("https://app.example");
  });
});

describe("signInUrl", () => {
  it("keeps the requested URL", () => {
    expect(signInUrl("/chat")).toBe("/sign-in?next=%2Fchat");
    expect(signInUrl("/builds")).toBe("/sign-in?next=%2Fbuilds");
    expect(signInUrl("/references?doc=1")).toBe("/sign-in?next=%2Freferences%3Fdoc%3D1");
  });

  it("drops a meaningless or unsafe destination", () => {
    expect(signInUrl("/")).toBe("/sign-in");
    expect(signInUrl("//evil.example")).toBe("/sign-in");
  });
});
