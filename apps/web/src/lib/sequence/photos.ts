// Names of uploaded step photo files (build-sequence: Step Photo Storage):
// `<upload time in ms>_<random suffix>.<original file extension>`.

const SUFFIX_LENGTH = 8;
const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** The extension of the original file name, or one derived from its media type. */
export function photoExtension(fileName: string, mediaType: string): string {
  const dot = fileName.lastIndexOf(".");
  const fromName = dot > 0 ? fileName.slice(dot + 1) : "";
  if (/^[A-Za-z0-9]{1,16}$/.test(fromName)) return fromName;
  const subtype = (mediaType.split("/")[1] ?? "").split("+")[0] ?? "";
  if (/^[A-Za-z0-9]{1,16}$/.test(subtype)) return subtype === "jpeg" ? "jpg" : subtype;
  return "jpg";
}

function randomSuffix(randomValues: (array: Uint8Array) => Uint8Array): string {
  const bytes = randomValues(new Uint8Array(SUFFIX_LENGTH));
  let suffix = "";
  for (const byte of bytes) suffix += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length];
  return suffix;
}

/** A unique storage file name for an uploaded photo. */
export function photoFileName(
  file: { name: string; type: string },
  now: number = Date.now(),
  randomValues: (array: Uint8Array) => Uint8Array = (array) => crypto.getRandomValues(array),
): string {
  return `${now}_${randomSuffix(randomValues)}.${photoExtension(file.name, file.type)}`;
}
