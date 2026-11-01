import type { Database } from "@gb/db";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicEnv } from "../env";

export interface SessionUpdate {
  /** The response to return (or to copy cookies and headers from). */
  response: NextResponse;
  /** The signed-in user's id, or null without a valid session. */
  userId: string | null;
}

/**
 * Refreshes the Supabase session for this request and reports who is signed in.
 * Renewed tokens are written to both the forwarded request and the response.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Must run before any response is produced: it may refresh the tokens.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { response, userId };
}

/**
 * A redirect that keeps any refreshed session cookies. Its target depends on the
 * session, so no cache may keep it: browsers otherwise replay a stale signed-out
 * redirect on Back and loop between the sign-in screen and the section.
 */
export function redirectWithSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  redirect.headers.set("cache-control", "private, no-cache, no-store, max-age=0, must-revalidate");
  redirect.headers.set("expires", "0");
  redirect.headers.set("pragma", "no-cache");
  return redirect;
}
