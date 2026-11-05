import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Call = [method: string, ...args: unknown[]];

/** A Supabase client double that records the query and answers with `result`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const query = new Proxy(
    {},
    {
      get(_, method: string) {
        if (method === "then") {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push([method, ...args]);
          return query;
        };
      },
    },
  );
  const from = (table: string) => {
    calls.push(["from", table]);
    return query;
  };
  return { client: { from }, calls };
}

const server = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => server.client }));

const { listRecentBuilds } = await import("./queries");

describe("listRecentBuilds", () => {
  it("asks for the user's own builds, most recently changed first, at most the given count", async () => {
    const fake = fakeClient({ data: [], error: null });
    server.client = fake.client;
    await listRecentBuilds("user-1", 5);
    expect(fake.calls).toEqual([
      ["from", "builds"],
      ["select", "id, name"],
      ["eq", "owner_id", "user-1"],
      ["order", "updated_at", { ascending: false }],
      ["limit", 5],
    ]);
  });

  it("returns the builds' ids and names", async () => {
    server.client = fakeClient({
      data: [
        { id: "b2", name: "OM Cedar" },
        { id: "b1", name: "Parlour" },
      ],
      error: null,
    }).client;
    expect(await listRecentBuilds("user-1", 5)).toEqual([
      { id: "b2", name: "OM Cedar" },
      { id: "b1", name: "Parlour" },
    ]);
  });

  it.each([
    ["an error", { data: null, error: { message: "boom" } }],
    [
      "an error with stale rows",
      { data: [{ id: "b1", name: "Parlour" }], error: { message: "boom" } },
    ],
    ["no rows at all", { data: null, error: null }],
  ])("returns no builds on %s, so the navigation still renders", async (_, result) => {
    server.client = fakeClient(result).client;
    expect(await listRecentBuilds("user-1", 5)).toEqual([]);
  });
});
