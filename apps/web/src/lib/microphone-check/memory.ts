import type { LevelVerdict, RateVerdict } from "@gb/dsp";

const KEY = "gb.microphoneChecks.v1";
const RATE_VERDICTS: readonly RateVerdict["verdict"][] = ["accurate", "corrected", "mismatch"];
const LEVEL_VERDICTS: readonly LevelVerdict[] = ["noTap", "clipping", "low", "good"];

export type CheckedInput = { readonly id: string; readonly label: string | null };

export type RememberedCheck = {
  readonly checkedAt: string;
  readonly rate: RateVerdict["verdict"];
  readonly trueRate?: number;
  readonly measuredRate: number;
  readonly level: LevelVerdict;
};

type Entry = CheckedInput & RememberedCheck;

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  values.some((candidate) => candidate === value);

const parseEntry = (value: unknown): Entry | null => {
  if (typeof value !== "object" || value === null) return null;
  const field = (name: string): unknown => Reflect.get(value, name);
  const [id, label, checkedAt, rate, trueRate, measuredRate, level] = [
    "id",
    "label",
    "checkedAt",
    "rate",
    "trueRate",
    "measuredRate",
    "level",
  ].map(field);
  if (
    typeof id !== "string" ||
    (typeof label !== "string" && label !== null) ||
    typeof checkedAt !== "string" ||
    !isOneOf(RATE_VERDICTS, rate) ||
    (trueRate !== undefined && typeof trueRate !== "number") ||
    typeof measuredRate !== "number" ||
    !isOneOf(LEVEL_VERDICTS, level)
  ) {
    return null;
  }
  return {
    id,
    label,
    checkedAt,
    rate,
    measuredRate,
    level,
    ...(typeof trueRate === "number" ? { trueRate } : {}),
  };
};

const parseEntries = (stored: string | null): readonly Entry[] => {
  try {
    const parsed: unknown = JSON.parse(stored ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const list: readonly unknown[] = parsed;
    return list.map(parseEntry).filter((entry): entry is Entry => entry !== null);
  } catch {
    return [];
  }
};

const readEntries = (getStorage: () => Storage): readonly Entry[] | null => {
  try {
    return parseEntries(getStorage().getItem(KEY));
  } catch {
    return null;
  }
};

const matches = (entry: Entry, input: CheckedInput) =>
  entry.id === input.id || (input.label !== null && entry.label === input.label);

export const readCheck = (
  getStorage: () => Storage,
  input: CheckedInput,
): RememberedCheck | null => {
  const entry = readEntries(getStorage)?.find((candidate) => matches(candidate, input));
  if (!entry) return null;
  const { id: _id, label: _label, ...check } = entry;
  return check;
};

export const rememberCheck = (
  getStorage: () => Storage,
  input: CheckedInput,
  check: RememberedCheck,
): void => {
  const entries = readEntries(getStorage);
  if (!entries) return;
  const next = [...entries.filter((entry) => !matches(entry, input)), { ...input, ...check }];
  try {
    getStorage().setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the check is shown but not remembered.
  }
};
