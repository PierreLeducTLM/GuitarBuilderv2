import type { NextRequest } from "next/server";
import { classifyPath, DEFAULT_ROUTE, safeNextPath, signInUrl } from "@/lib/routes";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

/**
 * The access gate (app-shell: Authenticated Access Gate, Public Build Story Route,
 * Default and Unknown Route Redirects). Refreshes the session on every request, then:
 * story pages are public; everything else needs a session; "/" and unknown paths go
 * to /builds. The admin-only rule needs the role and is applied by the admin layout.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const kind = classifyPath(pathname);
  const { response, userId } = await updateSession(request);

  if (kind === "story" || kind === "authCallback") return response;

  if (kind === "signIn") {
    if (!userId) return response;
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return redirectWithSession(new URL(next, request.url), response);
  }

  if (!userId) {
    return redirectWithSession(new URL(signInUrl(`${pathname}${search}`), request.url), response);
  }

  if (kind === "root" || kind === "unknown") {
    return redirectWithSession(new URL(DEFAULT_ROUTE, request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|woff2?|ttf)$).*)",
  ],
};
