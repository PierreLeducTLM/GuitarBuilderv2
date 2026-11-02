import type { GuitarType } from "@gb/db";

/** A card of the builds list (guitar-builds: Builds List). */
export interface BuildSummary {
  id: string;
  name: string;
  guitarType: GuitarType | null;
  createdAt: string;
}

/** What the detail page needs about one build. */
export interface BuildDetailData extends BuildSummary {
  ownerId: string;
  boboNeck: boolean;
  updatedAt: string;
  /** The stored step state, read leniently by `mergeStepState`. */
  sequenceState: unknown;
}
