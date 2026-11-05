import { readFileSync } from "node:fs";
import { create } from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { FIGURE_CHARACTERS, figureText, REPORT_FONTS } from "./report-fonts";

const publicFile = (path: string) =>
  readFileSync(new URL(`../../../public${path}`, import.meta.url));

const strings = (value: unknown): string[] =>
  typeof value === "string"
    ? [value.replace(/\{[^}]*\}/g, "")]
    : typeof value === "object" && value !== null
      ? Object.values(value).flatMap(strings)
      : [];

const characters = (texts: readonly string[]) => [...new Set(texts.join(""))].sort();

const missing = (path: string, texts: readonly string[]) => {
  const font = create(publicFile(path));
  return characters(texts).filter((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === undefined || !font.hasGlyphForCodePoint(codePoint);
  });
};

describe("PDF report fonts", () => {
  it("draws every character of the wood texts in English and French in Space Grotesk", () => {
    const texts = [...strings(en.wood), ...strings(fr.wood)];
    expect(missing(REPORT_FONTS.words.regular, texts)).toEqual([]);
    expect(missing(REPORT_FONTS.words.bold, texts)).toEqual([]);
  });

  it("draws the numbers, units and symbols, including ρ, ³ and –, in JetBrains Mono", () => {
    expect(FIGURE_CHARACTERS).toContain("ρ");
    expect(FIGURE_CHARACTERS).toContain("³");
    expect(FIGURE_CHARACTERS).toContain("–");
    expect(FIGURE_CHARACTERS).toContain("0123456789");
    expect(missing(REPORT_FONTS.figures.regular, [FIGURE_CHARACTERS])).toEqual([]);
    expect(missing(REPORT_FONTS.figures.bold, [FIGURE_CHARACTERS])).toEqual([]);
  });

  it("sets French digit grouping with a no-break space Mono has", () => {
    const grouped = new Intl.NumberFormat("fr", { minimumFractionDigits: 1 }).format(1000);
    expect(grouped).toBe("1\u202f000,0");
    expect(figureText(grouped)).toBe("1\u00a0000,0");
    expect(missing(REPORT_FONTS.figures.regular, [figureText(grouped)])).toEqual([]);
    expect(missing(REPORT_FONTS.figures.regular, [grouped])).toEqual(["\u202f"]);
  });

  it("needs Mono for ρ, which Space Grotesk does not have", () => {
    expect(missing(REPORT_FONTS.words.regular, ["ρ"])).toEqual(["ρ"]);
  });
});
