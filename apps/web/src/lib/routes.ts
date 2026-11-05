import type { AppRole } from "@gb/db";

/** app-shell: Application Sections and URLs, in navigation order. */
export const sections = [
  { id: "builds", href: "/builds", adminOnly: false },
  { id: "chat", href: "/chat", adminOnly: false },
  { id: "simulator", href: "/simulator", adminOnly: false },
  { id: "woodProperties", href: "/wood-properties", adminOnly: false },
  { id: "references", href: "/references", adminOnly: true },
  { id: "admin", href: "/admin", adminOnly: true },
] as const;

export type Section = (typeof sections)[number];
export type SectionId = Section["id"];

export const DEFAULT_ROUTE = "/builds";
export const SIGN_IN_ROUTE = "/sign-in";

/** Sections the given role may see. Until the role is known, pass `null`: admin entries stay hidden. */
export function sectionsFor(role: AppRole | null): Section[] {
  return sections.filter((section) => !section.adminOnly || role === "admin");
}

/** app-shell: Application Sections and URLs — the four destinations, in navigation order. */
export const destinations = [
  { id: "builds", href: "/builds", sections: [] },
  {
    id: "tools",
    href: "/tools",
    sections: [
      { id: "woodPanels", href: "/wood-properties" },
      { id: "simulator", href: "/simulator" },
    ],
  },
  { id: "assistant", href: "/chat", sections: [] },
  { id: "you", href: "/you", sections: [] },
] as const;

const adminEntries = [
  { id: "references", href: "/references" },
  { id: "admin", href: "/admin" },
] as const;

export type Destination = (typeof destinations)[number];
export type DestinationId = Destination["id"];
export type AdminEntry = (typeof adminEntries)[number];
export type EntryId = DestinationId | Destination["sections"][number]["id"] | AdminEntry["id"];

/** app-shell: Admin-Only Sections. Until the role is known, pass `null`: nothing is shown. */
export function adminEntriesFor(role: AppRole | null): readonly AdminEntry[] {
  return role === "admin" ? adminEntries : [];
}

/** app-shell: Navigation Entry Presentation — the entry whose URL prefix matches is active. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const holds = (destination: Destination, pathname: string) =>
  [destination, ...destination.sections].some((entry) => isActive(pathname, entry.href));

/** The bottom-tab-bar destination that holds `pathname`, or null (admin pages have no tab). */
export function activeTab(pathname: string): DestinationId | null {
  return destinations.find((destination) => holds(destination, pathname))?.id ?? null;
}

/** The most specific sidebar entry that holds `pathname`, or null. */
export function activeEntry(pathname: string): EntryId | null {
  const entries = [
    ...destinations.flatMap((destination) => destination.sections),
    ...destinations,
    ...adminEntries,
  ];
  return entries.find((entry) => isActive(pathname, entry.href))?.id ?? null;
}

export type RouteKind =
  | "story"
  | "signIn"
  | "authCallback"
  | "root"
  | "section"
  | "adminSection"
  | "unknown";

/** Classifies a path for the access gate (see design.md, decision 4). */
export function classifyPath(pathname: string): RouteKind {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return "root";
  if (/^\/story\/[^/]+$/.test(path)) return "story";
  if (path === SIGN_IN_ROUTE) return "signIn";
  if (path === "/auth/confirm") return "authCallback";
  if (path === "/references" || path === "/admin") return "adminSection";
  if (/^\/builds(\/[^/]+)?$/.test(path)) return "section";
  if (path === "/chat" || path === "/simulator" || path === "/wood-properties") return "section";
  return "unknown";
}

/**
 * Accepts a post-sign-in destination only if it is a path on this site; anything
 * else (absolute URLs, `//host`, backslashes, the sign-in page itself) becomes the
 * default route. Prevents open redirects.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next?.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_ROUTE;
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(next)) return DEFAULT_ROUTE;
  try {
    const base = "https://guitar-builder.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return DEFAULT_ROUTE;
    const kind = classifyPath(url.pathname);
    if (kind === "signIn" || kind === "authCallback") return DEFAULT_ROUTE;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_ROUTE;
  }
}

/** The sign-in URL that brings the visitor back to `pathAndQuery` afterwards. */
export function signInUrl(pathAndQuery: string): string {
  const next = safeNextPath(pathAndQuery);
  const meaningless = next === "/" || (next === DEFAULT_ROUTE && pathAndQuery !== DEFAULT_ROUTE);
  return meaningless ? SIGN_IN_ROUTE : `${SIGN_IN_ROUTE}?next=${encodeURIComponent(next)}`;
}
