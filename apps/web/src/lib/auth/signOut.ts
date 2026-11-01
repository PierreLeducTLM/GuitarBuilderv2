/**
 * Ends the session in this browser (user-auth: Sign Out Ends Session) without losing
 * it on failure (app-shell: Sign Out From the Shell — on failure "the user remains
 * signed in").
 *
 * supabase-js `signOut()` clears the local session even when the server refuses, so
 * the server session is ended first through the logout endpoint, and the local
 * session is cleared only after that succeeded.
 */

interface AuthErrorLike {
  status?: number;
  name?: string;
}

export interface SignOutClient {
  auth: {
    getSession(): Promise<{ data: { session: { access_token: string } | null } }>;
    admin: {
      signOut(jwt: string, scope?: "global" | "local" | "others"): Promise<{ error: unknown }>;
    };
    signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
  };
}

/** The server no longer knows this session: it is ended already. */
function alreadyEnded(error: unknown): boolean {
  const { status, name } = (error ?? {}) as AuthErrorLike;
  return status === 401 || status === 403 || status === 404 || name === "AuthSessionMissingError";
}

export async function signOutThisBrowser(client: SignOutClient): Promise<{ ok: boolean }> {
  try {
    const { data } = await client.auth.getSession();
    if (data.session) {
      const { error } = await client.auth.admin.signOut(data.session.access_token, "local");
      if (error && !alreadyEnded(error)) return { ok: false };
    }
    // The server session is gone; this clears the cookies whatever the second call says.
    await client.auth.signOut({ scope: "local" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
