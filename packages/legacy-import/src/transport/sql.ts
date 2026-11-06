import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

export type Row = Readonly<Record<string, unknown>>;

export interface SqlExecutor {
  /** Runs one row-returning statement and returns its rows. */
  query(sql: string): Promise<readonly Row[]>;
  /** Runs a script (one or more statements) for its effect. */
  execute(sql: string): Promise<void>;
}

type Fetch = typeof fetch;

const MANAGEMENT_API = "https://api.supabase.com/v1";

const isRowList = (value: unknown): value is Row[] =>
  Array.isArray(value) && value.every((row) => typeof row === "object" && row !== null);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const errorDetail = (body: string): string => {
  const parsed = parseJson(body);
  return typeof parsed === "object" && parsed !== null && "message" in parsed
    ? String(parsed.message)
    : body;
};

export function managementApiExecutor(options: {
  accessToken: string;
  projectRef: string;
  fetch?: Fetch;
}): SqlExecutor {
  const fetchFn = options.fetch ?? fetch;
  const send = async (sql: string): Promise<unknown> => {
    const response = await fetchFn(
      `${MANAGEMENT_API}/projects/${options.projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      },
    );
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`SQL request failed (${response.status}): ${errorDetail(body)}`);
    }
    return JSON.parse(body);
  };
  return {
    async query(sql) {
      const rows = await send(sql);
      if (!isRowList(rows)) {
        throw new Error("SQL request returned something other than a list of rows");
      }
      return rows;
    },
    async execute(sql) {
      await send(sql);
    },
  };
}

export type PsqlRun = (options: {
  args: readonly string[];
  input: string;
  readOnly: boolean;
}) => Promise<{ stdout: string }>;

/** Runs a command with the script on stdin; a read-only run sets default_transaction_read_only. */
export const spawnCommand =
  (command: string): PsqlRun =>
  ({ args, input, readOnly }) =>
    new Promise((resolve, reject) => {
      const env = readOnly
        ? { ...process.env, PGOPTIONS: "-c default_transaction_read_only=on" }
        : process.env;
      const child = spawn(command, args, { env });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
      child.on("error", reject);
      child.stdin.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") reject(error);
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve({ stdout: Buffer.concat(stdout).toString("utf8") });
          return;
        }
        reject(
          new Error(
            `${command} failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`,
          ),
        );
      });
      child.stdin.end(input);
    });

export const spawnPsql: PsqlRun = spawnCommand("psql");

const withoutTrailingSemicolons = (sql: string): string => sql.trim().replace(/[;\s]+$/, "");

export function psqlExecutor(options: {
  databaseUrl: string;
  run?: PsqlRun;
  readOnly?: boolean;
}): SqlExecutor {
  const run = options.run ?? spawnPsql;
  const readOnlySession = options.readOnly ?? false;
  const args = [options.databaseUrl, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-f", "-"];
  return {
    async query(sql) {
      const wrapped = `select coalesce(json_agg(q), '[]'::json) from (${withoutTrailingSemicolons(sql)}) q;\n`;
      const { stdout } = await run({ args, input: wrapped, readOnly: readOnlySession });
      const rows: unknown = JSON.parse(stdout);
      if (!isRowList(rows)) {
        throw new Error("SQL request returned something other than a list of rows");
      }
      return rows;
    },
    async execute(sql) {
      await run({ args, input: `${sql}\n`, readOnly: readOnlySession });
    },
  };
}

const READ_ONLY_REFUSAL =
  "The first-version project is read-only: only a single select may run on it";

const WRITING_WORDS =
  /\b(insert|update|delete|truncate|alter|drop|create|grant|revoke|merge|copy|call|vacuum|lock|into|share)\b/i;

const isSingleSelect = (sql: string): boolean => {
  const statement = withoutTrailingSemicolons(sql);
  return (
    /^(select|with)\b/i.test(statement) &&
    !statement.includes(";") &&
    !WRITING_WORDS.test(statement)
  );
};

/** Guards the first-version end: only a single select ever reaches it. */
export function readOnly(executor: SqlExecutor): SqlExecutor {
  return {
    async query(sql) {
      if (!isSingleSelect(sql)) {
        throw new Error(READ_ONLY_REFUSAL);
      }
      return executor.query(sql);
    },
    async execute() {
      throw new Error(READ_ONLY_REFUSAL);
    },
  };
}

const defaultTag = (): string => randomBytes(6).toString("hex");

/** A dollar-quoted SQL literal whose tag does not occur in the text. */
export function dollarQuote(text: string, options: { randomTag?: () => string } = {}): string {
  const randomTag = options.randomTag ?? defaultTag;
  const drawTag = (): string => {
    const tag = `$gb_${randomTag()}$`;
    return text.includes(tag) ? drawTag() : tag;
  };
  const tag = drawTag();
  return `${tag}${text}${tag}`;
}
