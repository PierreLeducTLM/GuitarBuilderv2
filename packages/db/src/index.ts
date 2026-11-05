export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "./database.types.ts";
export {
  type BodyRole,
  type GuitarType,
  guitarTypes,
  type MeasurementRoles,
  type SpectrumRecord,
  STEP_PHOTOS_BUCKET,
  type StepChange,
  type StepEntry,
  type StepMeasurement,
  type StepPhoto,
  stepPhotoPath,
  toGuitarType,
} from "./steps.ts";
export {
  WOOD_SPECTRUM_KEYS,
  type WoodPanelSpectra,
  type WoodSpectrumKey,
} from "./wood.ts";

/** The two roles of user-auth. A missing or unreadable profile counts as `user`. */
export const appRoles = ["user", "admin"] as const;
export type AppRole = (typeof appRoles)[number];

export function toAppRole(value: unknown): AppRole {
  return value === "admin" ? "admin" : "user";
}
