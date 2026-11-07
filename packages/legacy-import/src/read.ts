import type { TableColumns } from "./convert/accounts.ts";
import type { PanelInputs, V2PanelResults } from "./convert/panels.ts";
import { dollarQuote, type Row, type SqlExecutor } from "./transport/sql.ts";

/** First-version tables that later changes import (legacy-data-migration). */
export const LATER_TABLES = [
  "public.fft_results",
  "public.settings",
  "public.reference_documents",
  "public.document_embeddings",
  "public.conversations",
  "public.messages",
] as const;

/** First-version tables that are never imported (Records Not Migrated). */
export const NEVER_TABLES = [
  "public.instagram_accounts",
  "public.scheduled_posts",
  "public.posted_steps",
] as const;

export type TableCount = { table: string; rows: number | null };

export type LegacySnapshot = {
  users: Row[];
  identities: Row[];
  profiles: { id: string; role: unknown }[];
  builds: Row[];
  panels: Row[];
  defaultPanels: Row[];
  photoObjects: string[];
  mfaFactors: number;
  tableCounts: TableCount[];
};

export type TargetSnapshot = {
  columns: { users: TableColumns; identities: TableColumns };
  accounts: { id: string; email: string | null }[];
  buildIds: ReadonlySet<string>;
  panelIds: ReadonlySet<string>;
  defaultPanelIds: ReadonlySet<string>;
};

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const wholeRows = async (executor: SqlExecutor, table: string): Promise<Row[]> => {
  const rows = await executor.query(
    `select to_jsonb(t) as row from ${table} t order by t.created_at, t.id`,
  );
  return rows.map((row) => row.row).filter(isRow);
};

const text = (value: unknown): string => String(value);

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

const countOf = (value: unknown): number => (typeof value === "number" ? value : 0);

const countQuery = (tables: readonly string[]): string =>
  `select t.name, case when to_regclass(t.name) is null then null else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %s', t.name), false, true, '')))[1]::text::int end as rows from (values ${tables.map((table) => `('${table}')`).join(", ")}) as t(name)`;

/** Everything the import reads from the first-version project, each as a single select. */
export async function readLegacy(source: SqlExecutor): Promise<LegacySnapshot> {
  const [users, identities, profiles, builds, panels, defaultPanels, objects, mfa, counts] =
    await Promise.all([
      wholeRows(source, "auth.users"),
      wholeRows(source, "auth.identities"),
      source.query("select id, role from public.user_profiles"),
      wholeRows(source, "public.guitar_builds"),
      wholeRows(source, "public.wood_panels"),
      wholeRows(source, "public.default_wood_panels"),
      source.query(
        "select name from storage.objects where bucket_id = 'step-photos' order by name",
      ),
      source.query("select count(*)::int as count from auth.mfa_factors"),
      source.query(countQuery([...LATER_TABLES, ...NEVER_TABLES])),
    ]);
  return {
    users,
    identities,
    profiles: profiles.map((row) => ({ id: text(row.id), role: row.role })),
    builds,
    panels,
    defaultPanels,
    photoObjects: objects.map((row) => text(row.name)),
    mfaFactors: countOf(mfa[0]?.count),
    tableCounts: counts.map((row) => ({
      table: text(row.name),
      rows: typeof row.rows === "number" ? row.rows : null,
    })),
  };
}

const columnsOf = (rows: readonly Row[], table: string): TableColumns => {
  const own = rows.filter((row) => row.table_name === table);
  return {
    writable: own
      .filter((row) => row.is_generated !== "ALWAYS")
      .map((row) => text(row.column_name)),
    generated: own
      .filter((row) => row.is_generated === "ALWAYS")
      .map((row) => text(row.column_name)),
  };
};

const idSet = (rows: readonly Row[]): ReadonlySet<string> =>
  new Set(rows.map((row) => text(row.id)));

/** What the import needs to know about the v2 project before planning. */
export async function readTarget(target: SqlExecutor): Promise<TargetSnapshot> {
  const [columns, accounts, builds, panels, defaultPanels] = await Promise.all([
    target.query(
      "select table_name, column_name, is_generated from information_schema.columns where table_schema = 'auth' and table_name in ('users', 'identities') order by ordinal_position",
    ),
    target.query("select id, email from auth.users"),
    target.query("select id from public.builds"),
    target.query("select id from public.wood_panels"),
    target.query("select id from public.default_wood_panels"),
  ]);
  return {
    columns: { users: columnsOf(columns, "users"), identities: columnsOf(columns, "identities") },
    accounts: accounts.map((row) => ({ id: text(row.id), email: textOrNull(row.email) })),
    buildIds: idSet(builds),
    panelIds: idSet(panels),
    defaultPanelIds: idSet(defaultPanels),
  };
}

const SAMPLE = "p.sample_length_mm, p.sample_width_mm, p.sample_thickness_mm, p.sample_mass_g";
const ALL_INPUTS = `${SAMPLE}, p.freq_longitudinal_hz, p.freq_cross_grain_hz, p.freq_diagonal_hz, p.plate_length_mm, p.plate_width_mm, p.stiffness_parameter`;
const RECORD_COLUMNS =
  "id text, sample_length_mm double precision, sample_width_mm double precision, sample_thickness_mm double precision, sample_mass_g double precision, freq_longitudinal_hz double precision, freq_cross_grain_hz double precision, freq_diagonal_hz double precision, plate_length_mm double precision, plate_width_mm double precision, stiffness_parameter double precision";

/**
 * v2's E_C, target thickness and estimated mass for each panel's inputs, computed by the same
 * SQL functions as its generated columns, so the report shows what v2 stores (also in a dry run).
 */
export async function readV2PanelResults(
  target: SqlExecutor,
  panels: readonly (PanelInputs & { id: string })[],
): Promise<Map<string, V2PanelResults>> {
  if (panels.length === 0) return new Map();
  const rows = await target.query(
    `select p.id, public.wood_e_cross_gpa(${SAMPLE}, p.freq_cross_grain_hz) as e_cross_gpa, public.wood_target_thickness_mm(${ALL_INPUTS}) as target_thickness_mm, public.wood_estimated_mass_g(${ALL_INPUTS}) as estimated_mass_g from jsonb_to_recordset(${dollarQuote(JSON.stringify(panels))}::jsonb) as p(${RECORD_COLUMNS})`,
  );
  return new Map(
    rows.map((row) => {
      const { e_cross_gpa, target_thickness_mm, estimated_mass_g } = row;
      if (
        typeof e_cross_gpa !== "number" ||
        typeof target_thickness_mm !== "number" ||
        typeof estimated_mass_g !== "number"
      ) {
        throw new Error(`v2 could not compute the results of panel ${text(row.id)}`);
      }
      return [
        text(row.id),
        {
          eCrossGpa: e_cross_gpa,
          targetThicknessMm: target_thickness_mm,
          estimatedMassG: estimated_mass_g,
        },
      ];
    }),
  );
}
