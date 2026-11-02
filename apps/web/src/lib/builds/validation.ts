// Client-side checks of the creation and variant forms. The database enforces the same
// rules (builds_name_not_blank, the guitar type check and policies).
import type { GuitarType } from "@gb/db";

export interface NewBuildInput {
  name: string;
  guitarType: GuitarType | null;
}

export interface NewBuildErrors {
  name?: "required";
  guitarType?: "required";
}

/** A name needs one non-whitespace character; there is no length limit or uniqueness rule. */
export function validateNewBuild(input: NewBuildInput): NewBuildErrors {
  const errors: NewBuildErrors = {};
  if (!/\S/.test(input.name)) errors.name = "required";
  if (!input.guitarType) errors.guitarType = "required";
  return errors;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a URL segment can be a build id at all. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
