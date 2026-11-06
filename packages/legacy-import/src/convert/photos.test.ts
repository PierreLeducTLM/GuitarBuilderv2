import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inferGuitarType, isV2PhotoName, photoSourcePath, targetPhotoName } from "./photos.ts";

const BUILD = "e0000000-0000-4000-8000-00000000000e";

describe("photoSourcePath", () => {
  it("uses the legacy file name when it is a build/step/file path", () => {
    expect(
      photoSourcePath({
        url: "https://legacy.supabase.co/storage/v1/object/public/step-photos/other/path.jpg",
        fileName: `${BUILD}/Bracing/1733500000000_k3j9x.jpg`,
      }),
    ).toBe(`${BUILD}/Bracing/1733500000000_k3j9x.jpg`);
  });

  it("falls back to the part of the URL after /step-photos/, decoded", () => {
    expect(
      photoSourcePath({
        url: `https://legacy.supabase.co/storage/v1/object/public/step-photos/${BUILD}/Bracing/17_my%20photo.JPG`,
        fileName: "my photo.JPG",
      }),
    ).toBe(`${BUILD}/Bracing/17_my photo.JPG`);
  });

  it("ignores a query string on the URL", () => {
    expect(
      photoSourcePath({
        url: `https://l.supabase.co/x/step-photos/${BUILD}/Bracing/1_a.jpg?t=1#top`,
      }),
    ).toBe(`${BUILD}/Bracing/1_a.jpg`);
  });

  it.each([
    ["a two-part file name", { fileName: "Bracing/x.jpg" }],
    ["a file name with an empty part", { fileName: `${BUILD}//x.jpg` }],
    ["a URL outside the bucket", { url: "https://elsewhere.example/x.jpg" }],
    ["a URL with three parts but no bucket", { url: "https://abcde/s/f.jpg" }],
    ["a missing photo", null],
    ["nothing usable", { url: 3, fileName: null }],
    ["a photo that is not an object", "x.jpg"],
  ])("finds no path for %s", (_label, photo) => {
    expect(photoSourcePath(photo)).toBeNull();
  });

  it("keeps a URL path that cannot be decoded as it is", () => {
    expect(
      photoSourcePath({ url: `https://l.supabase.co/x/step-photos/${BUILD}/Bracing/1_a%E0.jpg` }),
    ).toBe(`${BUILD}/Bracing/1_a%E0.jpg`);
  });
});

describe("isV2PhotoName", () => {
  it.each([
    ["1733500000000_k3j9x.jpg", true],
    ["1_a.b", true],
    [`${"1".repeat(16)}_${"a".repeat(32)}.${"c".repeat(16)}`, true],
    [`${"1".repeat(17)}_a.jpg`, false],
    [`1_${"a".repeat(33)}.jpg`, false],
    [`1_a.${"c".repeat(17)}`, false],
    ["1733500000000_k3j9x", false],
    ["1733500000000_k3.j9x.jpg", false],
    ["photo_k3j9x.jpg", false],
    ["1_a b.jpg", false],
    ["x1_a.jpg", false],
    ["1_a.jpgx!", false],
  ])("%s → %s", (name, expected) => {
    expect(isV2PhotoName(name)).toBe(expected);
  });
});

describe("targetPhotoName", () => {
  const suffixOf = (path: string): string =>
    BigInt(`0x${createHash("sha256").update(path).digest("hex")}`)
      .toString(36)
      .slice(0, 8);

  it("keeps a legacy name that already follows the v2 rule", () => {
    expect(
      targetPhotoName({
        sourcePath: `${BUILD}/Bracing/1733500000000_k3j9x.jpg`,
        buildCreatedAt: "2025-01-01T00:00:00Z",
        contentType: "image/jpeg",
      }),
    ).toBe("1733500000000_k3j9x.jpg");
  });

  it("renames with the legacy timestamp, a hash suffix and the legacy extension", () => {
    const sourcePath = `${BUILD}/Bracing/1733500000000_my photo.JPG`;

    expect(
      targetPhotoName({ sourcePath, buildCreatedAt: "2025-01-01T00:00:00Z", contentType: "x" }),
    ).toBe(`1733500000000_${suffixOf(sourcePath)}.JPG`);
  });

  it("uses the build's creation time when the legacy name has no leading digits", () => {
    const sourcePath = `${BUILD}/Bracing/photo.png`;

    expect(
      targetPhotoName({ sourcePath, buildCreatedAt: "2025-01-01T00:00:00Z", contentType: "x" }),
    ).toBe(`1735689600000_${suffixOf(sourcePath)}.png`);
  });

  it("uses the build's creation time when the leading digits are too long", () => {
    const sourcePath = `${BUILD}/Bracing/${"9".repeat(17)}_x.png`;

    expect(
      targetPhotoName({ sourcePath, buildCreatedAt: "2025-01-01T00:00:00Z", contentType: "x" }),
    ).toBe(`1735689600000_${suffixOf(sourcePath)}.png`);
  });

  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/svg+xml", "svg"],
    ["image/heic; charset=binary", "heic"],
    ["application/octet-stream", "bin"],
    [" image/png", "png"],
    ["text/plain; image/png", "bin"],
    ["", "bin"],
  ])("derives the extension from %s when the legacy one is unusable", (contentType, extension) => {
    const sourcePath = `${BUILD}/Bracing/1733500000000_ab.my photo`;

    expect(
      targetPhotoName({ sourcePath, buildCreatedAt: "2025-01-01T00:00:00Z", contentType }),
    ).toBe(`1733500000000_${suffixOf(sourcePath)}.${extension}`);
  });

  it("derives the extension when the legacy name has no dot", () => {
    const sourcePath = `${BUILD}/Bracing/1733500000000_IMG`;

    expect(
      targetPhotoName({
        sourcePath,
        buildCreatedAt: "2025-01-01T00:00:00Z",
        contentType: "image/png",
      }),
    ).toBe(`1733500000000_${suffixOf(sourcePath)}.png`);
  });

  it("derives the extension for a bare name without digits or dot", () => {
    const sourcePath = `${BUILD}/Bracing/IMG`;

    expect(
      targetPhotoName({
        sourcePath,
        buildCreatedAt: "2025-01-01T00:00:00Z",
        contentType: "image/png",
      }),
    ).toBe(`1735689600000_${suffixOf(sourcePath)}.png`);
  });

  it("is the same on every run and differs between sources", () => {
    const options = { buildCreatedAt: "2025-01-01T00:00:00Z", contentType: "image/png" };
    const first = targetPhotoName({ ...options, sourcePath: `${BUILD}/Bracing/a b.png` });

    expect(targetPhotoName({ ...options, sourcePath: `${BUILD}/Bracing/a b.png` })).toBe(first);
    expect(targetPhotoName({ ...options, sourcePath: `${BUILD}/Bracing/a c.png` })).not.toBe(first);
    expect(first).toMatch(/^1735689600000_[0-9a-z]{8}\.png$/);
    expect(isV2PhotoName(first)).toBe(true);
  });
});

describe("inferGuitarType", () => {
  it("is classical when only classical-only steps have data", () => {
    expect(inferGuitarType(["TrussRod", "FabricateCLBridge"])).toBe("classical");
  });

  it("counts the classical BOBO slat steps as classical-only", () => {
    expect(inferGuitarType(["CLGlueBOBO1"])).toBe("classical");
  });

  it("is steel-string when only steel-string-only steps have data", () => {
    expect(inferGuitarType(["SSCutBridge", "TrussRod", "OldCustomStep"])).toBe("steel_string");
  });

  it("is not set when both kinds of variant step have data", () => {
    expect(inferGuitarType(["FabricateCLBridge", "FabricateBridge"])).toBeNull();
  });

  it("is not set when no variant step has data", () => {
    expect(inferGuitarType(["TrussRod", "OldCustomStep"])).toBeNull();
    expect(inferGuitarType([])).toBeNull();
  });
});
