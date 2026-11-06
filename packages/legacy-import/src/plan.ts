import { type AccountPlan, planAccounts } from "./convert/accounts.ts";
import { type BuildPlan, convertBuild } from "./convert/builds.ts";
import {
  convertDefaultPanel,
  convertPanel,
  type DefaultPanelRow,
  type PanelPlan,
  type PanelRow,
} from "./convert/panels.ts";
import { photoSourcePath } from "./convert/photos.ts";
import { convertSteps } from "./convert/steps.ts";
import type { LegacySnapshot, TableCount, TargetSnapshot } from "./read.ts";

export type ImportPlan = {
  accounts: AccountPlan[];
  builds: BuildPlan[];
  panels: PanelPlan<PanelRow>[];
  defaultPanels: PanelPlan<DefaultPanelRow>[];
  /** First-version photo files that no build references; they are not copied. */
  orphanPhotos: number;
  mfaFactors: number;
  tableCounts: TableCount[];
  /** Records v2 already holds, so the report can tell updates from additions. */
  existing: {
    accountIds: ReadonlySet<string>;
    buildIds: ReadonlySet<string>;
    panelIds: ReadonlySet<string>;
    defaultPanelIds: ReadonlySet<string>;
  };
};

const referencedPhotos = (builds: LegacySnapshot["builds"]): ReadonlySet<string | null> =>
  new Set(
    builds.flatMap((build) =>
      convertSteps(build.sequence_diagram).steps.flatMap((step) =>
        step.legacyPhotos.map(photoSourcePath),
      ),
    ),
  );

/** Everything the import will do, decided from both snapshots before anything is written. */
export function planImport(legacy: LegacySnapshot, target: TargetSnapshot): ImportPlan {
  const accounts = planAccounts({
    legacyUsers: legacy.users,
    legacyIdentities: legacy.identities,
    legacyProfiles: legacy.profiles,
    targetColumns: target.columns,
    targetAccounts: target.accounts,
  });
  const owners = {
    imported: new Set(accounts.filter((a) => a.kind === "import").map((a) => a.id)),
    skipped: new Map(
      accounts.flatMap((a) => (a.kind === "skip" ? [[a.id, a.reason] as const] : [])),
    ),
  };
  const referenced = referencedPhotos(legacy.builds);
  return {
    accounts,
    builds: legacy.builds.map((build) => convertBuild(build, owners)),
    panels: legacy.panels.map((panel) => convertPanel(panel, owners)),
    defaultPanels: legacy.defaultPanels.map(convertDefaultPanel),
    orphanPhotos: legacy.photoObjects.filter((name) => !referenced.has(name)).length,
    mfaFactors: legacy.mfaFactors,
    tableCounts: legacy.tableCounts,
    existing: {
      accountIds: new Set(target.accounts.map((account) => account.id)),
      buildIds: target.buildIds,
      panelIds: target.panelIds,
      defaultPanelIds: target.defaultPanelIds,
    },
  };
}
