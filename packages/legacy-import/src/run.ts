import { STEP_PHOTOS_BUCKET, type StepPhoto, stepPhotoPath } from "@gb/db";
import type { BuildPlan } from "./convert/builds.ts";
import { finalStepState } from "./convert/builds.ts";
import {
  comparePanelResults,
  type PanelPlan,
  type PanelResults,
  type V2PanelResults,
} from "./convert/panels.ts";
import { targetPhotoName } from "./convert/photos.ts";
import { type ImportPlan, planImport } from "./plan.ts";
import { readLegacy, readTarget, readV2PanelResults } from "./read.ts";
import type { SqlExecutor } from "./transport/sql.ts";
import { publicObjectUrl, type SourceStorage, type TargetStorage } from "./transport/storage.ts";
import {
  accountScript,
  buildScript,
  defaultPanelsScript,
  panelsScript,
  verificationQuery,
} from "./write.ts";

export type Ends = {
  source: { sql: SqlExecutor; storage: SourceStorage; supabaseUrl: string };
  target: { sql: SqlExecutor; storage: TargetStorage };
};

export type MissingPhoto = { build: string; step: string; path: string };

export type PanelChange = {
  table: "wood_panels" | "default_wood_panels";
  id: string;
  name: string;
  old: PanelResults;
  new: V2PanelResults;
};

export type Failure = {
  kind: "build" | "panels" | "default-panels";
  id: string;
  name: string;
  error: string;
};

export type RunResult = {
  apply: boolean;
  plan: ImportPlan;
  photos: { copied: number; missing: MissingPhoto[] };
  panelChanges: PanelChange[];
  failures: Failure[];
  verification: Readonly<Record<string, unknown>> | null;
};

const PANEL_BATCH = 50;

type ImportedBuild = Extract<BuildPlan, { kind: "import" }>;

type BuildOutcome = {
  missing: MissingPhoto[];
  copiedPaths: string[];
  failure: Failure | null;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const importedOf = <T extends { kind: string }>(
  plans: readonly T[],
): Extract<T, { kind: "import" }>[] =>
  plans.filter((plan): plan is Extract<T, { kind: "import" }> => plan.kind === "import");

const chunks = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

const photoSources = (build: ImportedBuild) =>
  build.steps.flatMap((step) => step.photoSources.map((path) => ({ step: step.entry.key, path })));

/** Dry run: a HEAD request per photo, so missing files show before anything is written. */
const checkBuild = async (ends: Ends, build: ImportedBuild): Promise<BuildOutcome> => {
  const checks = await Promise.all(
    photoSources(build).map(async ({ step, path }) => ({
      step,
      path,
      found: await ends.source.storage.exists(
        publicObjectUrl(ends.source.supabaseUrl, STEP_PHOTOS_BUCKET, path),
      ),
    })),
  );
  return {
    missing: checks
      .filter((check) => !check.found)
      .map(({ step, path }) => ({ build: build.id, step, path })),
    copiedPaths: [],
    failure: null,
  };
};

/** Apply: copy each photo, then write the build in one transaction. */
const importBuild = async (ends: Ends, build: ImportedBuild): Promise<BuildOutcome> => {
  const copied = new Map<string, StepPhoto>();
  const missing: MissingPhoto[] = [];
  try {
    for (const { step, path } of photoSources(build)) {
      const download = await ends.source.storage.download(
        publicObjectUrl(ends.source.supabaseUrl, STEP_PHOTOS_BUCKET, path),
      );
      if (!download.found) {
        missing.push({ build: build.id, step, path });
        continue;
      }
      const name = targetPhotoName({
        sourcePath: path,
        buildCreatedAt: String(build.row.created_at),
        contentType: download.contentType,
      });
      const targetPath = stepPhotoPath(build.id, step, name);
      await ends.target.storage.upload({
        bucket: STEP_PHOTOS_BUCKET,
        path: targetPath,
        bytes: download.bytes,
        contentType: download.contentType,
      });
      copied.set(`${step}/${path}`, {
        url: ends.target.storage.publicUrl(STEP_PHOTOS_BUCKET, targetPath),
        name,
      });
    }
    const state = finalStepState(
      build.steps,
      (step, path) => copied.get(`${step}/${path}`) ?? null,
    );
    await ends.target.sql.execute(buildScript(build.row, state));
    return { missing, copiedPaths: [...copied.values()].map((photo) => photo.url), failure: null };
  } catch (error) {
    return {
      missing,
      copiedPaths: [],
      failure: { kind: "build", id: build.id, name: build.name, error: messageOf(error) },
    };
  }
};

const panelChanges = <R>(
  table: PanelChange["table"],
  plans: readonly PanelPlan<R>[],
  results: ReadonlyMap<string, V2PanelResults>,
): PanelChange[] =>
  importedOf(plans).flatMap((plan) => {
    const current = results.get(plan.id);
    const change = current === undefined ? null : comparePanelResults(plan.legacyResults, current);
    return change === null
      ? []
      : [{ table, id: plan.id, name: plan.name, old: change.old, new: change.new }];
  });

const runBatch = async (
  ends: Ends,
  kind: Failure["kind"],
  ids: readonly string[],
  script: string,
): Promise<Failure | null> => {
  try {
    await ends.target.sql.execute(script);
    return null;
  } catch (error) {
    return { kind, id: ids.join(", "), name: "", error: messageOf(error) };
  }
};

/**
 * legacy-data-migration: reads both projects, plans, and either reports (dry run) or imports
 * accounts, builds with their photos, wood panels and default panels, then checks v2's counts.
 */
export async function runImport(options: { ends: Ends; apply: boolean }): Promise<RunResult> {
  const { ends, apply } = options;
  const [legacy, target] = await Promise.all([
    readLegacy(ends.source.sql),
    readTarget(ends.target.sql),
  ]);
  const plan = planImport(legacy, target);
  const panels = importedOf(plan.panels);
  const defaults = importedOf(plan.defaultPanels);
  const [panelResults, defaultResults] = await Promise.all([
    readV2PanelResults(
      ends.target.sql,
      panels.map((p) => p.row),
    ),
    readV2PanelResults(
      ends.target.sql,
      defaults.map((p) => p.row),
    ),
  ]);

  const accounts = importedOf(plan.accounts);
  if (apply) {
    for (const account of accounts) {
      await ends.target.sql.execute(accountScript(account));
    }
  }

  const builds = importedOf(plan.builds);
  const outcomes: BuildOutcome[] = [];
  for (const build of builds) {
    outcomes.push(apply ? await importBuild(ends, build) : await checkBuild(ends, build));
  }

  const panelFailures: Failure[] = [];
  if (apply) {
    for (const batch of chunks(panels, PANEL_BATCH)) {
      const ids = batch.map((p) => p.id);
      const failure = await runBatch(ends, "panels", ids, panelsScript(batch.map((p) => p.row)));
      if (failure) panelFailures.push(failure);
    }
    if (defaults.length > 0) {
      const ids = defaults.map((p) => p.id);
      const failure = await runBatch(
        ends,
        "default-panels",
        ids,
        defaultPanelsScript(defaults.map((p) => p.row)),
      );
      if (failure) panelFailures.push(failure);
    }
  }

  const failures = [...outcomes.flatMap((o) => (o.failure ? [o.failure] : [])), ...panelFailures];
  const failedIds = new Set(failures.flatMap((failure) => failure.id.split(", ")));
  const succeeded = (ids: readonly string[]) => ids.filter((id) => !failedIds.has(id));
  const copiedUrls = outcomes.flatMap((o) => o.copiedPaths);
  const verification = apply
    ? ((
        await ends.target.sql.query(
          verificationQuery({
            accounts: accounts.map((a) => a.id),
            builds: succeeded(builds.map((b) => b.id)),
            panels: succeeded(panels.map((p) => p.id)),
            defaultPanels: succeeded(defaults.map((p) => p.id)),
            photoPaths: copiedUrls.map((url) =>
              url.slice(url.indexOf(`/${STEP_PHOTOS_BUCKET}/`) + STEP_PHOTOS_BUCKET.length + 2),
            ),
          }),
        )
      )[0] ?? null)
    : null;

  return {
    apply,
    plan,
    photos: { copied: copiedUrls.length, missing: outcomes.flatMap((o) => o.missing) },
    panelChanges: [
      ...panelChanges("wood_panels", plan.panels, panelResults),
      ...panelChanges("default_wood_panels", plan.defaultPanels, defaultResults),
    ],
    failures,
    verification,
  };
}
