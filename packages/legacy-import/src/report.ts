import type { BuildNote, BuildPlan } from "./convert/builds.ts";
import type { PanelNote, PanelPlan, PanelResults } from "./convert/panels.ts";
import type { RunResult } from "./run.ts";

export type ReportMeta = { startedAt: Date; sourceProject: string; targetProject: string };

export type ReportFiles = { markdown: string; json: string };

type Counted = { imported: number; updated: number; skipped: number };

export type Summary = {
  accounts: Counted & { givenProfile: number; admins: number };
  builds: Counted & { typeNotSet: number; dimensionsDropped: number };
  panels: Counted & { changed: number };
  defaultPanels: Counted & { changed: number };
  photos: { toCopy: number; copied: number; missing: number; orphaned: number };
  spectra: { reduced: number; refused: number };
  failures: number;
};

const modeOf = (apply: boolean): string => (apply ? "apply" : "dry-run");

/** `<UTC timestamp>-<dry-run|apply>`, the base name of both report files. */
export function reportFileBase(meta: ReportMeta, apply: boolean): string {
  const stamp = meta.startedAt
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replaceAll(/[-:]/g, "");
  return `${stamp}-${modeOf(apply)}`;
}

const imported = <T extends { kind: string }>(
  plans: readonly T[],
): Extract<T, { kind: "import" }>[] =>
  plans.filter((plan): plan is Extract<T, { kind: "import" }> => plan.kind === "import");

const skippedOf = <T extends { kind: string }>(
  plans: readonly T[],
): Extract<T, { kind: "skip" }>[] =>
  plans.filter((plan): plan is Extract<T, { kind: "skip" }> => plan.kind === "skip");

const counted = (
  plans: readonly { kind: string; id: string }[],
  existing: ReadonlySet<string>,
): Counted => {
  const toImport = plans.filter((plan) => plan.kind === "import");
  return {
    imported: toImport.length,
    updated: toImport.filter((plan) => existing.has(plan.id)).length,
    skipped: plans.filter((plan) => plan.kind === "skip").length,
  };
};

const buildNotes = (result: RunResult): { build: string; note: BuildNote }[] =>
  imported(result.plan.builds).flatMap((build) =>
    build.notes.map((note) => ({ build: build.name, note })),
  );

const panelNotes = (result: RunResult): { panel: string; note: PanelNote }[] =>
  [...imported(result.plan.panels), ...imported(result.plan.defaultPanels)].flatMap((panel) =>
    panel.notes.map((note) => ({ panel: `"${panel.name}" (${panel.id})`, note })),
  );

const countKind = (notes: readonly { note: { kind: string } }[], kind: string): number =>
  notes.filter(({ note }) => note.kind === kind).length;

export function summarize(result: RunResult): Summary {
  const { plan } = result;
  const accounts = imported(plan.accounts);
  const builds = imported(plan.builds);
  const fromBuilds = buildNotes(result);
  const fromPanels = panelNotes(result);
  return {
    accounts: {
      ...counted(plan.accounts, plan.existing.accountIds),
      givenProfile: accounts.filter((account) => account.givenProfile).length,
      admins: accounts.filter((account) => account.role === "admin").length,
    },
    builds: {
      ...counted(plan.builds, plan.existing.buildIds),
      typeNotSet: builds.filter((build) => build.row.guitar_type === null).length,
      dimensionsDropped: countKind(fromBuilds, "dimensions-dropped"),
    },
    panels: {
      ...counted(plan.panels, plan.existing.panelIds),
      changed: result.panelChanges.filter((change) => change.table === "wood_panels").length,
    },
    defaultPanels: {
      ...counted(plan.defaultPanels, plan.existing.defaultPanelIds),
      changed: result.panelChanges.filter((change) => change.table === "default_wood_panels")
        .length,
    },
    photos: {
      toCopy: builds.reduce(
        (total, build) =>
          total + build.steps.reduce((sum, step) => sum + step.photoSources.length, 0),
        0,
      ),
      copied: result.photos.copied,
      missing: result.photos.missing.length,
      orphaned: plan.orphanPhotos,
    },
    spectra: {
      reduced:
        countKind(fromBuilds, "spectrum-reduced") + countKind(fromPanels, "spectrum-reduced"),
      refused:
        countKind(fromBuilds, "measurement-skipped") + countKind(fromPanels, "spectrum-refused"),
    },
    failures: result.failures.length,
  };
}

const compactBuild = (build: BuildPlan) =>
  build.kind === "skip"
    ? build
    : {
        kind: build.kind,
        id: build.id,
        name: build.name,
        ownerId: build.row.owner_id,
        guitarType: build.row.guitar_type,
        shared: build.row.share_enabled,
        steps: build.steps.map((step) => ({
          key: step.entry.key,
          photos: step.photoSources.length,
          measurements: step.entry.measurements.length,
        })),
        notes: build.notes,
      };

const compactPanel = <R>(panel: PanelPlan<R>) =>
  panel.kind === "skip"
    ? panel
    : {
        kind: panel.kind,
        id: panel.id,
        name: panel.name,
        legacyResults: panel.legacyResults,
        notes: panel.notes,
      };

/** The JSON report: plain data for tests and later runs, without Auth rows or spectra. */
export function reportJson(result: RunResult, meta: ReportMeta) {
  const { plan } = result;
  return {
    mode: modeOf(result.apply),
    startedAt: meta.startedAt.toISOString(),
    sourceProject: meta.sourceProject,
    targetProject: meta.targetProject,
    summary: summarize(result),
    plan: {
      accounts: plan.accounts.map((account) =>
        account.kind === "skip"
          ? account
          : {
              kind: account.kind,
              id: account.id,
              email: account.email,
              role: account.role,
              givenProfile: account.givenProfile,
              droppedColumns: account.droppedColumns,
            },
      ),
      builds: plan.builds.map(compactBuild),
      panels: plan.panels.map(compactPanel),
      defaultPanels: plan.defaultPanels.map(compactPanel),
      orphanPhotos: plan.orphanPhotos,
      mfaFactors: plan.mfaFactors,
      tableCounts: plan.tableCounts,
      existing: {
        accountIds: [...plan.existing.accountIds],
        buildIds: [...plan.existing.buildIds],
        panelIds: [...plan.existing.panelIds],
        defaultPanelIds: [...plan.existing.defaultPanelIds],
      },
    },
    photos: result.photos,
    panelChanges: result.panelChanges,
    failures: result.failures,
    verification: result.verification,
  };
}

const escapeCell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

const bullets = (items: readonly string[], empty = "None."): string[] =>
  items.length === 0 ? [empty] : items.map((item) => `- ${item}`);

/** A `##` section; its lines start with a blank line or a subsection. */
const section = (title: string, lines: readonly string[]): string[] => [
  "",
  `## ${title}`,
  ...lines,
];

const paragraph = (lines: readonly string[]): string[] => ["", ...lines];

const subsection = (title: string, lines: readonly string[]): string[] => [
  "",
  `### ${title}`,
  "",
  ...lines,
];

const fixed = (value: number | null, digits: number): string =>
  value === null ? "—" : value.toFixed(digits);

const describeBuildNote = (note: BuildNote): string | null => {
  switch (note.kind) {
    case "renamed":
      return `blank name, imported as "${note.to}"`;
    case "photo-without-path":
      return `a photo of step ${note.step} has no file path`;
    case "measurement-skipped":
      return `measurement ${note.measurement || "(no id)"} of step ${note.step} skipped: ${note.reason}`;
    case "spectrum-reduced":
      return `spectrum of measurement ${note.measurement} (step ${note.step}) reduced from ${note.from} to ${note.to} points`;
    case "duplicate-step":
      return `step ${note.step} appears twice; the first is kept`;
    case "step-without-key":
      return "a step without a key was left out";
    default:
      return null;
  }
};

const describePanelNote = (note: PanelNote): string => {
  switch (note.kind) {
    case "renamed":
      return `blank name, imported as "${note.to}"`;
    case "build-link-dropped":
      return "unused build link dropped";
    case "unknown-spectrum-key":
      return `spectrum under unknown key "${note.key}" ignored`;
    case "spectrum-reduced":
      return `${note.key} spectrum reduced from ${note.from} to ${note.to} points`;
    case "spectrum-refused":
      return `${note.key} spectrum left out: ${note.reason}`;
  }
};

const countsTable = (summary: Summary): string[] => [
  "| Kind | Imported | Of which updates | Skipped |",
  "| --- | ---: | ---: | ---: |",
  `| Accounts | ${summary.accounts.imported} | ${summary.accounts.updated} | ${summary.accounts.skipped} |`,
  `| Builds | ${summary.builds.imported} | ${summary.builds.updated} | ${summary.builds.skipped} |`,
  `| Wood panels | ${summary.panels.imported} | ${summary.panels.updated} | ${summary.panels.skipped} |`,
  `| Default panels | ${summary.defaultPanels.imported} | ${summary.defaultPanels.updated} | ${summary.defaultPanels.skipped} |`,
  "",
  `Step photos: ${summary.photos.toCopy} to copy, ${summary.photos.copied} copied, ${summary.photos.missing} missing. Photo files no build references (not copied): ${summary.photos.orphaned}.`,
];

const changesTable = (
  result: RunResult,
  table: "wood_panels" | "default_wood_panels",
): string[] => {
  const changes = result.panelChanges.filter((change) => change.table === table);
  if (changes.length === 0) return ["None."];
  const row = (name: string, old: PanelResults, current: PanelResults) =>
    `| ${escapeCell(name)} | ${fixed(old.eCrossGpa, 3)} → ${fixed(current.eCrossGpa, 3)} | ${fixed(old.targetThicknessMm, 2)} → ${fixed(current.targetThicknessMm, 2)} | ${fixed(old.estimatedMassG, 1)} → ${fixed(current.estimatedMassG, 1)} |`;
  return [
    "| Panel | E_C (GPa) | Target thickness (mm) | Estimated mass (g) |",
    "| --- | --- | --- | --- |",
    ...changes.map((change) => row(change.name, change.old, change.new)),
  ];
};

/** The Markdown report the owner reviews before (dry run) and after (apply) the import. */
export function reportMarkdown(result: RunResult, meta: ReportMeta): string {
  const { plan } = result;
  const summary = summarize(result);
  const accounts = imported(plan.accounts);
  const skippedAccounts = skippedOf(plan.accounts);
  const builds = imported(plan.builds);
  const skippedBuilds = skippedOf(plan.builds);
  const skippedPanels = [...skippedOf(plan.panels), ...skippedOf(plan.defaultPanels)];
  const ownedBy = (ownerId: string) => [
    ...skippedBuilds
      .filter((build) => build.ownerId === ownerId)
      .map((build) => `build "${build.name}" (${build.id})`),
    ...skippedOf(plan.panels)
      .filter((panel) => panel.ownerId === ownerId)
      .map((panel) => `wood panel "${panel.name}" (${panel.id})`),
  ];
  const droppedColumns = [...new Set(accounts.flatMap((account) => account.droppedColumns))];
  const lines = [
    `# Legacy import report: ${result.apply ? "apply" : "dry run"}`,
    "",
    `- Started: ${meta.startedAt.toISOString()}`,
    `- First-version project: ${meta.sourceProject}`,
    `- Target project: ${meta.targetProject}`,
    result.apply ? "- Mode: apply (records were written)" : "- Mode: dry run (nothing was written)",
    ...section("Counts", paragraph(countsTable(summary))),
    ...section("Accounts", [
      ...subsection(
        "Administrators",
        bullets(
          accounts
            .filter((a) => a.role === "admin")
            .map((a) => `${a.email ?? "(no email)"} (${a.id})`),
        ),
      ),
      ...subsection(
        "Given a profile (no first-version profile, imported as user)",
        bullets(
          accounts.filter((a) => a.givenProfile).map((a) => `${a.email ?? "(no email)"} (${a.id})`),
        ),
      ),
      ...subsection(
        "Skipped",
        bullets(
          skippedAccounts.map((a) => {
            const records = ownedBy(a.id);
            const withRecords =
              records.length === 0 ? "" : `; skipped with it: ${records.join(", ")}`;
            return `${a.email ?? "(no email)"} (${a.id}): ${a.reason}${withRecords}`;
          }),
        ),
      ),
      ...subsection(
        "Auth columns the target does not have (dropped)",
        bullets(droppedColumns.map((column) => `\`${column}\``)),
      ),
      ...paragraph([`MFA factors not migrated (users sign in again): ${plan.mfaFactors}.`]),
    ]),
    ...section("Builds", [
      ...subsection(
        "Skipped",
        bullets(skippedBuilds.map((b) => `"${b.name}" (${b.id}): ${b.reason}`)),
      ),
      ...subsection(
        "Guitar type not set (choose it in v2)",
        bullets(
          builds.filter((b) => b.row.guitar_type === null).map((b) => `"${b.name}" (${b.id})`),
        ),
      ),
      ...subsection(
        "Model name, width and length dropped",
        bullets(
          builds.flatMap((b) =>
            b.notes.flatMap((note) =>
              note.kind === "dimensions-dropped"
                ? [
                    `"${b.name}": model ${JSON.stringify(note.modelName)}, width ${JSON.stringify(note.width)}, length ${JSON.stringify(note.length)}`,
                  ]
                : [],
            ),
          ),
        ),
      ),
      ...subsection(
        "Missing photo files",
        bullets(
          result.photos.missing.map(
            (photo) => `build ${photo.build}, step ${photo.step}: \`${photo.path}\``,
          ),
        ),
      ),
      ...subsection(
        "Other notes",
        bullets(
          builds.flatMap((b) =>
            b.notes.flatMap((note) => {
              const text = describeBuildNote(note);
              return text === null ? [] : [`"${b.name}" (${b.id}): ${text}`];
            }),
          ),
        ),
      ),
    ]),
    ...section("Wood panels", [
      ...subsection("Values corrected by v2 (more than 0.1%)", changesTable(result, "wood_panels")),
      ...subsection("Default panels corrected by v2", changesTable(result, "default_wood_panels")),
      ...subsection(
        "Skipped",
        bullets(skippedPanels.map((p) => `"${p.name}" (${p.id}): ${p.reason}`)),
      ),
      ...subsection(
        "Other notes",
        bullets(
          panelNotes(result).map(({ panel, note }) => `${panel}: ${describePanelNote(note)}`),
        ),
      ),
    ]),
    ...section("First-version records not imported by this change", [
      "",
      "| Table | Rows |",
      "| --- | ---: |",
      ...plan.tableCounts.map((count) => `| ${count.table} | ${count.rows ?? "table missing"} |`),
    ]),
    ...section(
      "Failures",
      paragraph(
        bullets(
          result.failures.map(
            (f) => `${f.kind} ${f.id}${f.name ? ` ("${f.name}")` : ""}: ${f.error}`,
          ),
        ),
      ),
    ),
    ...(result.verification === null
      ? []
      : section("Post-apply check", [
          "",
          "| Record | In v2 |",
          "| --- | ---: |",
          ...Object.entries(result.verification).map(
            ([key, value]) => `| ${key} | ${String(value)} |`,
          ),
        ])),
  ];
  return `${lines.join("\n")}\n`;
}

/** What the terminal shows: counts and the report's location, never names or emails. */
export function terminalSummary(result: RunResult, files: ReportFiles): string {
  const s = summarize(result);
  return [
    `Mode: ${result.apply ? "apply" : "dry run (nothing written)"}`,
    `Accounts: ${s.accounts.imported} to import (${s.accounts.updated} updates, ${s.accounts.admins} admins, ${s.accounts.givenProfile} given a profile), ${s.accounts.skipped} skipped`,
    `Builds: ${s.builds.imported} to import (${s.builds.updated} updates, ${s.builds.typeNotSet} without a guitar type), ${s.builds.skipped} skipped`,
    `Wood panels: ${s.panels.imported} to import (${s.panels.changed} corrected), ${s.panels.skipped} skipped`,
    `Default panels: ${s.defaultPanels.imported} to import (${s.defaultPanels.changed} corrected), ${s.defaultPanels.skipped} skipped`,
    `Photos: ${s.photos.toCopy} to copy, ${s.photos.copied} copied, ${s.photos.missing} missing, ${s.photos.orphaned} orphaned`,
    `Spectra: ${s.spectra.reduced} reduced, ${s.spectra.refused} left out`,
    `Failures: ${s.failures}`,
    `Report: ${files.markdown}`,
    `JSON: ${files.json}`,
  ].join("\n");
}
