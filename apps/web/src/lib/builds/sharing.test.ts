import { describe, expect, it, vi } from "vitest";

type Call = [fn: string, args: unknown];

/** A browser-client double whose rpc() records the call and answers with `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const rpc = (fn: string, args: unknown) => {
    calls.push([fn, args]);
    return Promise.resolve(result);
  };
  return { client: { rpc }, calls };
}

const browser = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => browser.client }));

const { readShareToken, setSharing } = await import("./sharing");

const TOKEN = "dddddddd-0000-4000-8000-00000000000d";

describe("readShareToken", () => {
  it("reads the build's current link", async () => {
    const fake = fakeClient({ data: TOKEN, error: null });
    browser.client = fake.client;
    expect(await readShareToken("build-1")).toEqual({ ok: true, token: TOKEN });
    expect(fake.calls).toEqual([["build_share_token", { p_build_id: "build-1" }]]);
  });

  it("has no token when the build is not shared", async () => {
    browser.client = fakeClient({ data: null, error: null }).client;
    expect(await readShareToken("build-1")).toEqual({ ok: true, token: null });
  });

  it("fails when the server refuses", async () => {
    browser.client = fakeClient({ data: null, error: { code: "42501" } }).client;
    expect(await readShareToken("build-1")).toEqual({ ok: false });
  });
});

describe("setSharing", () => {
  it("turns sharing on and returns the link's token", async () => {
    const fake = fakeClient({ data: TOKEN, error: null });
    browser.client = fake.client;
    expect(await setSharing("build-1", true)).toEqual({ ok: true, token: TOKEN });
    expect(fake.calls).toEqual([
      ["set_build_sharing", { p_build_id: "build-1", p_enabled: true }],
    ]);
  });

  it("turns sharing off, leaving no token", async () => {
    const fake = fakeClient({ data: null, error: null });
    browser.client = fake.client;
    expect(await setSharing("build-1", false)).toEqual({ ok: true, token: null });
    expect(fake.calls).toEqual([
      ["set_build_sharing", { p_build_id: "build-1", p_enabled: false }],
    ]);
  });

  it("fails when the server refuses", async () => {
    browser.client = fakeClient({ data: null, error: { code: "42501" } }).client;
    expect(await setSharing("build-1", true)).toEqual({ ok: false });
  });

  it("fails when the request cannot be sent", async () => {
    browser.client = {
      rpc: () => Promise.reject(new Error("offline")),
    };
    expect(await setSharing("build-1", true)).toEqual({ ok: false });
    expect(await readShareToken("build-1")).toEqual({ ok: false });
  });
});
