import type { GuitarType, StepEntry, StepPhoto } from "@gb/db";
import type { Row } from "../transport/sql.ts";
import { inferGuitarType, photoSourcePath } from "./photos.ts";
import { convertSteps, type StepNote } from "./steps.ts";

export const UNTITLED_BUILD = "Untitled build";

export type BuildOwners = {
  imported: ReadonlySet<string>;
  /** Owners not imported, with the reason (an email conflict). */
  skipped: ReadonlyMap<string, string>;
};

export type BuildRow = {
  id: string;
  owner_id: string;
  name: string;
  guitar_type: GuitarType | null;
  bobo_neck: true;
  share_enabled: boolean;
  share_token: string | null;
  created_at: unknown;
  updated_at: unknown;
};

/** A step to write: its entry (photos filled after copying) and its photos' legacy paths. */
export type PlannedStep = { entry: StepEntry; photoSources: string[] };

export type BuildNote =
  | StepNote
  | { kind: "dimensions-dropped"; modelName: unknown; width: unknown; length: unknown }
  | { kind: "type-not-set" }
  | { kind: "renamed"; to: string }
  | { kind: "photo-without-path"; step: string };

export type BuildPlan =
  | {
      kind: "import";
      id: string;
      name: string;
      row: BuildRow;
      steps: PlannedStep[];
      notes: BuildNote[];
    }
  | { kind: "skip"; id: string; name: string; ownerId: string | null; reason: string };

const textOf = (value: unknown): string => (typeof value === "string" ? value : "");

const hasDimensions = (legacy: Row): boolean =>
  textOf(legacy.model_name).trim() !== "" ||
  (legacy.width !== null && legacy.width !== undefined) ||
  (legacy.length !== null && legacy.length !== undefined);

/** legacy-data-migration: Build Migration, Build Variant Inference, Stable Identifiers. */
export function convertBuild(legacy: Row, owners: BuildOwners): BuildPlan {
  const id = String(legacy.id);
  const trimmed = textOf(legacy.text_identifier).trim();
  const name = trimmed === "" ? UNTITLED_BUILD : trimmed;
  const ownerId = typeof legacy.user_id === "string" ? legacy.user_id : null;
  if (ownerId === null) return { kind: "skip", id, name, ownerId, reason: "no owner" };
  if (!owners.imported.has(ownerId)) {
    const reason = owners.skipped.get(ownerId) ?? "owner not imported";
    return { kind: "skip", id, name, ownerId, reason };
  }

  const converted = convertSteps(legacy.sequence_diagram);
  const steps = converted.steps.map((step) => ({
    entry: step.entry,
    sources: step.legacyPhotos.map(photoSourcePath),
  }));
  const guitarType = inferGuitarType(steps.map((step) => step.entry.key));
  const shared = legacy.share_enabled === true;
  const notes: BuildNote[] = [
    ...(trimmed === "" ? [{ kind: "renamed", to: UNTITLED_BUILD } as const] : []),
    ...(hasDimensions(legacy)
      ? [
          {
            kind: "dimensions-dropped",
            modelName: legacy.model_name,
            width: legacy.width,
            length: legacy.length,
          } as const,
        ]
      : []),
    ...(guitarType === null ? [{ kind: "type-not-set" } as const] : []),
    ...converted.notes,
    ...steps.flatMap((step) =>
      step.sources
        .filter((source) => source === null)
        .map(() => ({ kind: "photo-without-path", step: step.entry.key }) as const),
    ),
  ];
  return {
    kind: "import",
    id,
    name,
    row: {
      id,
      owner_id: ownerId,
      name,
      guitar_type: guitarType,
      bobo_neck: true,
      share_enabled: shared,
      share_token: shared && typeof legacy.share_token === "string" ? legacy.share_token : null,
      created_at: legacy.created_at,
      updated_at: legacy.updated_at,
    },
    steps: steps.map((step) => ({
      entry: step.entry,
      photoSources: step.sources.filter((source) => source !== null),
    })),
    notes,
  };
}

/** The v2 step state once photos are copied; a photo that was not copied is left out. */
export function finalStepState(
  steps: readonly PlannedStep[],
  photoFor: (stepKey: string, sourcePath: string) => StepPhoto | null,
): StepEntry[] {
  return steps.map(({ entry, photoSources }) => ({
    ...entry,
    photos: photoSources.flatMap((source) => {
      const photo = photoFor(entry.key, source);
      return photo === null ? [] : [photo];
    }),
  }));
}
