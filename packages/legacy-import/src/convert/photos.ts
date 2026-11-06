import { createHash } from "node:crypto";
import type { GuitarType } from "@gb/db";
import { TEMPLATE_STEPS } from "../../../../apps/web/src/lib/sequence/template.ts";

const V2_PHOTO_NAME = /^[0-9]{1,16}_[A-Za-z0-9]{1,32}\.[A-Za-z0-9]{1,16}$/;
const BUCKET_MARKER = "/step-photos/";

/** Whether a file name follows v2's step-photo naming rule (build-sequence: Step Photo Storage). */
export function isV2PhotoName(name: string): boolean {
  return V2_PHOTO_NAME.test(name);
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null;

const asBuildStepFile = (segments: readonly string[]): string | null =>
  segments.length === 3 && segments.every((segment) => segment !== "") ? segments.join("/") : null;

const decodeSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const pathFromUrl = (url: string): string | null => {
  const start = url.indexOf(BUCKET_MARKER);
  if (start === -1) return null;
  const path = url.slice(start + BUCKET_MARKER.length).replace(/[?#].*$/s, "");
  return asBuildStepFile(path.split("/").map(decodeSegment));
};

/** The legacy object path of a photo: its `fileName` when complete, otherwise from its URL. */
export function photoSourcePath(photo: unknown): string | null {
  if (!isObject(photo)) return null;
  const fromFileName =
    typeof photo.fileName === "string" ? asBuildStepFile(photo.fileName.split("/")) : null;
  if (fromFileName !== null) return fromFileName;
  return typeof photo.url === "string" ? pathFromUrl(photo.url) : null;
}

const leadingTimestamp = (name: string, buildCreatedAt: string): string =>
  /^([0-9]{1,16})(?![0-9])/.exec(name)?.[1] ?? String(Date.parse(buildCreatedAt));

const hashSuffix = (sourcePath: string): string =>
  BigInt(`0x${createHash("sha256").update(sourcePath).digest("hex")}`)
    .toString(36)
    .slice(0, 8);

const CONTENT_TYPE_EXTENSIONS: Readonly<Record<string, string>> = { jpeg: "jpg" };

const extensionFromContentType = (contentType: string): string => {
  const subtype = /^image\/([a-z0-9]{1,16})/i.exec(contentType.trim())?.[1]?.toLowerCase();
  return subtype === undefined ? "bin" : (CONTENT_TYPE_EXTENSIONS[subtype] ?? subtype);
};

const legacyExtension = (name: string): string | null => {
  const dot = name.lastIndexOf(".");
  const extension = dot === -1 ? "" : name.slice(dot + 1);
  return /^[A-Za-z0-9]{1,16}$/.test(extension) ? extension : null;
};

/**
 * The v2 file name of a copied photo: the legacy name when it already follows the v2 rule,
 * otherwise `<timestamp>_<suffix>.<extension>`, the same on every run for the same source.
 */
export function targetPhotoName(options: {
  sourcePath: string;
  buildCreatedAt: string;
  contentType: string;
}): string {
  const name = options.sourcePath.slice(options.sourcePath.lastIndexOf("/") + 1);
  if (isV2PhotoName(name)) return name;
  const timestamp = leadingTimestamp(name, options.buildCreatedAt);
  const extension = legacyExtension(name) ?? extensionFromContentType(options.contentType);
  return `${timestamp}_${hashSuffix(options.sourcePath)}.${extension}`;
}

const keysOf = (guitarType: GuitarType): ReadonlySet<string> =>
  new Set(TEMPLATE_STEPS.filter((step) => step.guitarType === guitarType).map((step) => step.key));

const CLASSICAL_ONLY = keysOf("classical");
const STEEL_STRING_ONLY = keysOf("steel_string");

/** legacy-data-migration: Build Variant Inference, from the keys of the steps with data. */
export function inferGuitarType(keysWithData: readonly string[]): GuitarType | null {
  const classical = keysWithData.some((key) => CLASSICAL_ONLY.has(key));
  const steelString = keysWithData.some((key) => STEEL_STRING_ONLY.has(key));
  if (classical === steelString) return null;
  return classical ? "classical" : "steel_string";
}
