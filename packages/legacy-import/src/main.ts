import { type ImportConfig, readConfig } from "./config.ts";
import { reportFileBase, reportJson, reportMarkdown, terminalSummary } from "./report.ts";
import { type Ends, runImport } from "./run.ts";
import { managementApiExecutor, psqlExecutor, readOnly } from "./transport/sql.ts";
import {
  fetchSecretKey,
  hostedProjectUrl,
  sourceStorage,
  targetStorage,
} from "./transport/storage.ts";

export type MainDeps = {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  cwd: string;
  now: () => Date;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  mkdir: (path: string) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  makeEnds: (config: ImportConfig) => Promise<Ends>;
};

const USAGE = "Usage: pnpm legacy:import [--apply]";
const REPORT_DIR = "reports/legacy-import";

const projectsOf = (config: ImportConfig): { source: string; target: string } =>
  config.mode === "hosted"
    ? { source: config.legacyProjectRef, target: config.targetProjectRef }
    : { source: config.legacySupabaseUrl, target: config.targetSupabaseUrl };

/** Both ends of the import; the first-version end only ever runs single selects. */
export async function endsFor(
  config: ImportConfig,
  options: { fetch?: typeof fetch },
): Promise<Ends> {
  if (config.mode === "local") {
    return {
      source: {
        sql: readOnly(psqlExecutor({ databaseUrl: config.legacyDatabaseUrl, readOnly: true })),
        storage: sourceStorage(options),
        supabaseUrl: config.legacySupabaseUrl,
      },
      target: {
        sql: psqlExecutor({ databaseUrl: config.targetDatabaseUrl }),
        storage: targetStorage({
          supabaseUrl: config.targetSupabaseUrl,
          secretKey: config.targetServiceKey,
          ...options,
        }),
      },
    };
  }
  const secretKey = await fetchSecretKey({
    accessToken: config.accessToken,
    projectRef: config.targetProjectRef,
    ...options,
  });
  const executor = (projectRef: string) =>
    managementApiExecutor({ accessToken: config.accessToken, projectRef, ...options });
  return {
    source: {
      sql: readOnly(executor(config.legacyProjectRef)),
      storage: sourceStorage(options),
      supabaseUrl: hostedProjectUrl(config.legacyProjectRef),
    },
    target: {
      sql: executor(config.targetProjectRef),
      storage: targetStorage({
        supabaseUrl: hostedProjectUrl(config.targetProjectRef),
        secretKey,
        ...options,
      }),
    },
  };
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** `pnpm legacy:import [--apply]`: 0 when done, 1 when a record or the run failed, 2 on usage. */
export async function main(deps: MainDeps): Promise<number> {
  const unknown = deps.argv.find((arg) => arg !== "--apply" && arg !== "--help");
  if (unknown !== undefined) {
    deps.stderr(`Unknown option: ${unknown}. ${USAGE}`);
    return 2;
  }
  if (deps.argv.includes("--help")) {
    deps.stdout(`${USAGE}\nWithout --apply, a dry run writes only the report.`);
    return 0;
  }
  const configResult = readConfig(deps.env);
  if (!configResult.ok) {
    deps.stderr(configResult.message);
    return 2;
  }
  const { config } = configResult;
  const apply = deps.argv.includes("--apply");
  const projects = projectsOf(config);
  deps.stdout(`First-version project: ${projects.source}\nTarget project: ${projects.target}`);
  const startedAt = deps.now();
  try {
    const result = await runImport({ ends: await deps.makeEnds(config), apply });
    const meta = { startedAt, sourceProject: projects.source, targetProject: projects.target };
    const base = `${REPORT_DIR}/${reportFileBase(meta, apply)}`;
    await deps.mkdir(`${deps.cwd}/${REPORT_DIR}`);
    await deps.writeFile(`${deps.cwd}/${base}.md`, reportMarkdown(result, meta));
    await deps.writeFile(
      `${deps.cwd}/${base}.json`,
      `${JSON.stringify(reportJson(result, meta), null, 2)}\n`,
    );
    deps.stdout(terminalSummary(result, { markdown: `${base}.md`, json: `${base}.json` }));
    return result.failures.length > 0 ? 1 : 0;
  } catch (error) {
    deps.stderr(`Import stopped: ${messageOf(error)}`);
    return 1;
  }
}
