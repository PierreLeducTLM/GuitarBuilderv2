import { describe, expect, it, vi } from "vitest";
import {
  dollarQuote,
  managementApiExecutor,
  type PsqlRun,
  psqlExecutor,
  readOnly,
  type SqlExecutor,
  spawnCommand,
} from "./sql.ts";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fakeFetch = (response: Response) => vi.fn<typeof fetch>(async () => response);

describe("managementApiExecutor", () => {
  it("posts the query to the project's SQL endpoint with the bearer token", async () => {
    const fetchFn = fakeFetch(jsonResponse(201, [{ id: 1 }]));
    const executor = managementApiExecutor({
      accessToken: "sbp_token",
      projectRef: "abcdref",
      fetch: fetchFn,
    });

    const rows = await executor.query("select 1 as id");

    expect(rows).toEqual([{ id: 1 }]);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.supabase.com/v1/projects/abcdref/database/query",
      {
        method: "POST",
        headers: { Authorization: "Bearer sbp_token", "Content-Type": "application/json" },
        body: JSON.stringify({ query: "select 1 as id" }),
      },
    );
  });

  it("runs a script and ignores what it returns", async () => {
    const fetchFn = fakeFetch(jsonResponse(201, []));
    const executor = managementApiExecutor({ accessToken: "t", projectRef: "r", fetch: fetchFn });

    await expect(executor.execute("begin; select 1; commit;")).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("reports the status and the API's message when the query fails", async () => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(jsonResponse(400, { message: 'relation "nope" does not exist' })),
    });

    await expect(executor.query("select * from nope")).rejects.toThrow(
      'SQL request failed (400): relation "nope" does not exist',
    );
  });

  it("reports the raw body when the error is not JSON", async () => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(new Response("Bad gateway", { status: 502 })),
    });

    await expect(executor.execute("select 1")).rejects.toThrow(
      "SQL request failed (502): Bad gateway",
    );
  });

  it("reports the raw body when the JSON error has no message", async () => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(new Response('{"error":"quota"}', { status: 429 })),
    });

    await expect(executor.execute("select 1")).rejects.toThrow(
      'SQL request failed (429): {"error":"quota"}',
    );
  });

  it("reports the raw body when the error is JSON null", async () => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(new Response("null", { status: 500 })),
    });

    await expect(executor.execute("select 1")).rejects.toThrow("SQL request failed (500): null");
  });

  it.each([
    ["a list of numbers", [1, 2]],
    ["a list holding null", [null]],
  ])("refuses a successful answer that is %s", async (_label, body) => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(jsonResponse(201, body)),
    });

    await expect(executor.query("select 1")).rejects.toThrow(
      "SQL request returned something other than a list of rows",
    );
  });

  it("refuses a successful answer that is not a list of rows", async () => {
    const executor = managementApiExecutor({
      accessToken: "t",
      projectRef: "r",
      fetch: fakeFetch(jsonResponse(201, { result: "odd" })),
    });

    await expect(executor.query("select 1")).rejects.toThrow(
      "SQL request returned something other than a list of rows",
    );
  });
});

describe("psqlExecutor", () => {
  const recordingRun = (stdout: string) => vi.fn<PsqlRun>(async () => ({ stdout }));

  it("returns the rows of a select as JSON through psql", async () => {
    const run = recordingRun('[{"id":1,"name":"OM"}]\n');
    const executor = psqlExecutor({ databaseUrl: "postgresql://local/db", run });

    const rows = await executor.query("  select id, name from builds; ;\n ");

    expect(rows).toEqual([{ id: 1, name: "OM" }]);
    expect(run).toHaveBeenCalledWith({
      args: ["postgresql://local/db", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      input: "select coalesce(json_agg(q), '[]'::json) from (select id, name from builds) q;\n",
      readOnly: false,
    });
  });

  it("refuses output that is not a list of rows", async () => {
    const executor = psqlExecutor({ databaseUrl: "postgresql://local/db", run: recordingRun("5") });

    await expect(executor.query("select 5")).rejects.toThrow(
      "SQL request returned something other than a list of rows",
    );
  });

  it("runs a script as it is", async () => {
    const run = recordingRun("");
    const executor = psqlExecutor({ databaseUrl: "postgresql://local/db", run });

    await executor.execute("begin; update t set a = 1; commit;");

    expect(run).toHaveBeenCalledWith({
      args: ["postgresql://local/db", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      input: "begin; update t set a = 1; commit;\n",
      readOnly: false,
    });
  });

  it("asks psql for a read-only session when told to", async () => {
    const run = recordingRun("[]");
    const executor = psqlExecutor({ databaseUrl: "postgresql://local/db", run, readOnly: true });

    await executor.query("select 1");

    expect(run).toHaveBeenCalledWith(expect.objectContaining({ readOnly: true }));
  });
});

describe("spawnCommand", () => {
  it("feeds the script on stdin and returns stdout", async () => {
    await expect(
      spawnCommand("sh")({ args: ["-c", "cat"], input: "select 1;\n", readOnly: false }),
    ).resolves.toEqual({ stdout: "select 1;\n" });
  });

  it("asks Postgres for read-only transactions in a read-only run", async () => {
    const printOptions = { args: ["-c", 'printf %s "$PGOPTIONS"'], input: "" };
    await expect(spawnCommand("sh")({ ...printOptions, readOnly: true })).resolves.toEqual({
      stdout: "-c default_transaction_read_only=on",
    });
    await expect(spawnCommand("sh")({ ...printOptions, readOnly: false })).resolves.not.toEqual({
      stdout: "-c default_transaction_read_only=on",
    });
  });

  it("fails with the exit code and the error output", async () => {
    await expect(
      spawnCommand("sh")({ args: ["-c", "echo ' boom ' >&2; exit 3"], input: "", readOnly: false }),
    ).rejects.toThrow(/^sh failed \(3\): boom$/);
  });

  it("fails when the command cannot start", async () => {
    await expect(
      spawnCommand("gb-no-such-command")({ args: [], input: "", readOnly: false }),
    ).rejects.toThrow("ENOENT");
  });
});

describe("readOnly", () => {
  const inner = (): SqlExecutor & { query: ReturnType<typeof vi.fn> } => ({
    query: vi.fn(async () => [{ ok: true }]),
    execute: vi.fn(async () => undefined),
  });

  it("passes a single select through", async () => {
    const executor = inner();
    await expect(readOnly(executor).query("select id, updated_at from builds")).resolves.toEqual([
      { ok: true },
    ]);
    expect(executor.query).toHaveBeenCalledWith("select id, updated_at from builds");
  });

  it("passes a select with a common table expression through", async () => {
    await expect(
      readOnly(inner()).query("WITH x AS (select 1) SELECT * FROM x"),
    ).resolves.toHaveLength(1);
  });

  it.each([
    ["an insert", "insert into builds values (1)"],
    ["a delete hidden in a CTE", "with d as (delete from builds returning *) select * from d"],
    ["an update hidden in a CTE", "with u as (update builds set name = 'x' returning *) select 1"],
    ["a second statement", "select 1; drop table builds"],
    ["a row lock", "select * from builds for update"],
    ["a truncate", "truncate builds"],
    ["two selects", "select 1; select 2"],
    ["a statement that is not a select", "show search_path"],
    ["an explain of a select", "explain select 1"],
  ])("refuses %s", async (_label, sql) => {
    const executor = inner();
    await expect(readOnly(executor).query(sql)).rejects.toThrow(
      "The first-version project is read-only: only a single select may run on it",
    );
    expect(executor.query).not.toHaveBeenCalled();
  });

  it("refuses every script", async () => {
    const executor = inner();
    await expect(readOnly(executor).execute("select 1")).rejects.toThrow(
      "The first-version project is read-only: only a single select may run on it",
    );
    expect(executor.execute).not.toHaveBeenCalled();
  });
});

describe("dollarQuote", () => {
  it("wraps the text in a dollar-quoted literal with a tag", () => {
    expect(dollarQuote(`{"a":"it's $1"}`, { randomTag: () => "q1a2" })).toBe(
      `$gb_q1a2$` + `{"a":"it's $1"}` + `$gb_q1a2$`,
    );
  });

  it("draws another tag while the text contains the drawn one", () => {
    const tags = ["aaaa", "bbbb"];
    const randomTag = vi.fn(() => tags.shift() ?? "zzzz");

    expect(dollarQuote("contains $gb_aaaa$ already", { randomTag })).toBe(
      "$gb_bbbb$contains $gb_aaaa$ already$gb_bbbb$",
    );
    expect(randomTag).toHaveBeenCalledTimes(2);
  });

  it("uses a random hexadecimal tag by default", () => {
    const first = dollarQuote("x");
    expect(first).toMatch(/^\$gb_([0-9a-f]{12})\$x\$gb_\1\$$/);
    expect(dollarQuote("x")).not.toBe(first);
  });
});
