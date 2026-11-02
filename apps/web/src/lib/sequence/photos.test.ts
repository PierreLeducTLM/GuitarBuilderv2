import { describe, expect, it } from "vitest";
import { photoExtension, photoFileName } from "./photos";

const fixedRandom = (array: Uint8Array) => {
  array.set([0, 1, 2, 25, 26, 35, 36, 71]);
  return array;
};

describe("photo file names", () => {
  it("is <upload time in ms>_<random suffix>.<original extension>", () => {
    expect(
      photoFileName({ name: "IMG_0042.HEIC", type: "image/heic" }, 1733500000000, fixedRandom),
    ).toBe("1733500000000_abcz09a9.HEIC");
  });

  it("gives the same file a different name each time", () => {
    const file = { name: "top.jpg", type: "image/jpeg" };
    expect(photoFileName(file, 1)).not.toBe(photoFileName(file, 1));
  });

  it("derives the extension from the media type when the name has none", () => {
    expect(photoExtension("image", "image/png")).toBe("png");
    expect(photoExtension("capture", "image/jpeg")).toBe("jpg");
    expect(photoExtension("drawing", "image/svg+xml")).toBe("svg");
    expect(photoExtension(".hidden", "")).toBe("jpg");
    expect(photoExtension("odd.name.with spaces", "image/webp")).toBe("webp");
  });
});
