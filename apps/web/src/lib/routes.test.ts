import { describe, expect, it } from "vitest";
import { classifyPath, isActive, safeNextPath, sectionsFor, signInUrl } from "./routes";

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
