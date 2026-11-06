import type { AppRole, StepEntry } from "@gb/db";
import type { BuildRow } from "./convert/builds.ts";
import type { DefaultPanelRow, PanelRow } from "./convert/panels.ts";
import { dollarQuote, type Row } from "./transport/sql.ts";

const quoteIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

const jsonLiteral = (value: unknown): string => `${dollarQuote(JSON.stringify(value))}::jsonb`;

/**
 * An upsert keyed on `id` that reads its values from JSON through the table's own row type,
 * so every value is typed by the database and no value is spliced into the SQL text.
 */
const upsert = (options: {
  table: string;
  columns: readonly string[];
  rows: unknown;
  many: boolean;
}): string => {
  const columns = options.columns.map(quoteIdentifier);
  const updates = options.columns
    .filter((column) => column !== "id")
    .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`);
  const source = options.many ? "jsonb_populate_recordset" : "jsonb_populate_record";
  return `insert into ${options.table} (${columns.join(", ")}) select ${columns.join(", ")} from ${source}(null::${options.table}, ${jsonLiteral(options.rows)}) on conflict (id) do update set ${updates.join(", ")};`;
};

const transaction = (statements: readonly string[]): string =>
  ["begin;", ...statements, "commit;"].join("\n");

const KEEP_UPDATED_AT = "set local gb.keep_updated_at = 'on';";

/** legacy-data-migration: Account Migration. One transaction per account. */
export function accountScript(account: {
  id: string;
  user: Row;
  identities: readonly Row[];
  role: AppRole;
}): string {
  const identityColumns = [...new Set(account.identities.flatMap((row) => Object.keys(row)))];
  return transaction([
    upsert({
      table: "auth.users",
      columns: Object.keys(account.user),
      rows: account.user,
      many: false,
    }),
    ...(account.identities.length > 0
      ? [
          upsert({
            table: "auth.identities",
            columns: identityColumns,
            rows: account.identities,
            many: true,
          }),
        ]
      : []),
    `insert into public.profiles (id, email, role) select u.id, u.email, '${account.role}' from auth.users u where u.id = ${dollarQuote(account.id)}::uuid on conflict (id) do update set email = excluded.email, role = excluded.role;`,
  ]);
}

/** legacy-data-migration: Build Migration. One transaction per build, after its photos. */
export function buildScript(row: BuildRow, state: readonly StepEntry[]): string {
  const record = { ...row, sequence_state: state };
  return transaction([
    KEEP_UPDATED_AT,
    upsert({ table: "public.builds", columns: Object.keys(record), rows: record, many: false }),
  ]);
}

/** legacy-data-migration: Wood Panel Recalculation. v2 regenerates the results. */
export function panelsScript(rows: readonly PanelRow[]): string {
  const columns = Object.keys(rows[0] ?? {});
  return transaction([
    KEEP_UPDATED_AT,
    upsert({ table: "public.wood_panels", columns, rows, many: true }),
  ]);
}

export function defaultPanelsScript(rows: readonly DefaultPanelRow[]): string {
  const columns = Object.keys(rows[0] ?? {});
  return transaction([upsert({ table: "public.default_wood_panels", columns, rows, many: true })]);
}

export type ImportedIds = {
  accounts: readonly string[];
  builds: readonly string[];
  panels: readonly string[];
  defaultPanels: readonly string[];
  photoPaths: readonly string[];
};

/** The post-apply check: how many of the imported records v2 now holds. */
export function verificationQuery(ids: ImportedIds): string {
  const list = (key: keyof ImportedIds): string =>
    `(select jsonb_array_elements_text(ids.j -> '${key}'))`;
  const count = (table: string, where: string, alias: string): string =>
    `(select count(*)::int from ${table} t, ids where ${where}) as ${alias}`;
  return `with ids as (select ${jsonLiteral(ids)} as j) select ${[
    count("auth.users", `t.id::text in ${list("accounts")}`, "accounts"),
    count("public.profiles", `t.role = 'admin' and t.id::text in ${list("accounts")}`, "admins"),
    count("public.profiles", `t.role = 'user' and t.id::text in ${list("accounts")}`, "users"),
    count("public.builds", `t.id::text in ${list("builds")}`, "builds"),
    count("public.wood_panels", `t.id::text in ${list("panels")}`, "panels"),
    count("public.default_wood_panels", `t.id::text in ${list("defaultPanels")}`, "default_panels"),
    count(
      "storage.objects",
      `t.bucket_id = 'step-photos' and t.name in ${list("photoPaths")}`,
      "photos",
    ),
  ].join(", ")} from ids`;
}
