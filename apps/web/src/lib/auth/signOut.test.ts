import { describe, expect, it, vi } from "vitest";
import { type SignOutClient, signOutThisBrowser } from "./signOut";

function client(
  logoutError: unknown,
  session: { access_token: string } | null = { access_token: "jwt" },
) {
  const localSignOut = vi.fn(async () => ({ error: null }));
  const serverSignOut = vi.fn(async () => ({ error: logoutError }));
  const stub: SignOutClient = {
    auth: {
      getSession: async () => ({ data: { session } }),
      admin: { signOut: serverSignOut },
      signOut: localSignOut,
    },
  };
  return { stub, localSignOut, serverSignOut };
}

describe("signOutThisBrowser", () => {
  it("ends the server session for this browser, then clears the local one", async () => {
    const { stub, localSignOut, serverSignOut } = client(null);
    expect(await signOutThisBrowser(stub)).toEqual({ ok: true });
    expect(serverSignOut).toHaveBeenCalledWith("jwt", "local");
    expect(localSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the user signed in when the service refuses", async () => {
    const { stub, localSignOut } = client({ name: "AuthApiError", status: 500 });
    expect(await signOutThisBrowser(stub)).toEqual({ ok: false });
    expect(localSignOut).not.toHaveBeenCalled();
  });

  it("keeps the user signed in when the service cannot be reached", async () => {
    const { stub, localSignOut } = client({ name: "AuthRetryableFetchError", status: 0 });
    expect(await signOutThisBrowser(stub)).toEqual({ ok: false });
    expect(localSignOut).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])(
    "treats a session the server no longer knows (%i) as ended",
    async (status) => {
      const { stub, localSignOut } = client({ name: "AuthApiError", status });
      expect(await signOutThisBrowser(stub)).toEqual({ ok: true });
      expect(localSignOut).toHaveBeenCalled();
    },
  );

  it("clears the local state when there is no session", async () => {
    const { stub, localSignOut, serverSignOut } = client(null, null);
    expect(await signOutThisBrowser(stub)).toEqual({ ok: true });
    expect(serverSignOut).not.toHaveBeenCalled();
    expect(localSignOut).toHaveBeenCalled();
  });
});
