import { readFileSync } from "node:fs";
import { woodProperties } from "@gb/dsp";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import fr from "../../../messages/fr.json";
import { DEFAULT_INPUTS, parseInputs } from "./calculator";
import { renderReport, splitRuns, wrap } from "./render-report";
import { type ReportContent, reportContent } from "./report";
import { REPORT_FONTS } from "./report-fonts";

const publicFile = (path: string) =>
  new Uint8Array(readFileSync(new URL(`../../../public${path}`, import.meta.url)));

const fonts = {
  words: {
    regular: publicFile(REPORT_FONTS.words.regular),
    bold: publicFile(REPORT_FONTS.words.bold),
  },
  figures: {
    regular: publicFile(REPORT_FONTS.figures.regular),
    bold: publicFile(REPORT_FONTS.figures.bold),
  },
};

const report = (overrides: Partial<ReportContent> = {}): ReportContent => ({
  ...reportContent({
    inputs: parseInputs(DEFAULT_INPUTS),
    properties: woodProperties(parseInputs(DEFAULT_INPUTS)),
    panelName: "Épicéa n° 3",
    generatedAt: new Date("2026-03-14T12:00:00Z"),
    locale: "fr",
    timeZone: "Europe/Paris",
    messages: fr.wood.report,
  }),
  ...overrides,
});

const A4: [number, number] = [595.28, 841.89];

const pages = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((page) => {
    const { width, height } = page.getSize();
    return [Math.round(width * 100) / 100, Math.round(height * 100) / 100];
  });

describe("font runs", () => {
  const spaceGrotesk = (codePoint: number) => codePoint !== 0x3c1 && codePoint !== 0x202f;

  it("draws the characters the words font lacks, such as ρ, with the fallback", () => {
    expect(splitRuns("Densité (ρ)", spaceGrotesk)).toEqual([
      { primary: true, text: "Densité (" },
      { primary: false, text: "ρ" },
      { primary: true, text: ")" },
    ]);
    expect(splitRuns("ρρ", spaceGrotesk)).toEqual([{ primary: false, text: "ρρ" }]);
    expect(splitRuns("", spaceGrotesk)).toEqual([]);
  });

  it("sets French digit grouping with a no-break space first", () => {
    expect(splitRuns("1\u202f000,0 kg/m³", spaceGrotesk)).toEqual([
      { primary: true, text: "1\u00a0000,0 kg/m³" },
    ]);
  });
});

describe("paragraph wrapping", () => {
  const characters = (text: string) => text.length;

  it("fills each line up to the width, breaking at spaces", () => {
    expect(wrap("one two three four", characters, 9)).toEqual(["one two", "three", "four"]);
    expect(wrap("one two three four", characters, 18)).toEqual(["one two three four"]);
    expect(wrap("  one   two  ", characters, 7)).toEqual(["one two"]);
  });

  it("keeps a word longer than the width on a line of its own", () => {
    expect(wrap("a spectacularly b", characters, 5)).toEqual(["a", "spectacularly", "b"]);
    expect(wrap("", characters, 5)).toEqual([]);
  });
});

describe("PDF report rendering", () => {
  it("lays the report out on one A4 page that pdf-lib can read back", async () => {
    const bytes = await renderReport(report(), fonts);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(await pages(bytes)).toEqual([A4]);
  });

  it("embeds subsets of the four fonts", async () => {
    const bytes = await renderReport(report(), fonts);
    const pdf = await PDFDocument.load(bytes);
    const baseFonts = pdf.context.enumerateIndirectObjects().flatMap(([, object]) => {
      const name = object instanceof PDFDict ? object.get(PDFName.of("BaseFont")) : undefined;
      return name instanceof PDFName ? [name.decodeText().replace(/-\d+$/, "")] : [];
    });
    expect([...new Set(baseFonts)].sort()).toEqual([
      "JetBrainsMono-Bold",
      "JetBrainsMono-Regular",
      "SpaceGrotesk-Bold",
      "SpaceGrotesk-Regular",
    ]);
    const fontBytes = [fonts.words, fonts.figures].reduce(
      (total, pair) => total + pair.regular.length + pair.bold.length,
      0,
    );
    expect(fontBytes).toBeGreaterThan(700_000);
    expect(bytes.length).toBeLessThan(50_000);
  });

  it("puts the analysis on a page of its own", async () => {
    const analysis = { heading: "Analyse IA", paragraphs: ["Une table équilibrée."] };
    expect(await pages(await renderReport(report({ analysis }), fonts))).toEqual([A4, A4]);
  });

  it("continues on further pages as needed", async () => {
    const paragraph = "Le module longitudinal est élevé pour cette densité. ".repeat(12);
    const analysis = {
      heading: "Analyse IA",
      paragraphs: Array.from({ length: 30 }, () => paragraph),
    };
    expect((await pages(await renderReport(report({ analysis }), fonts))).length).toBeGreaterThan(
      3,
    );

    const [inputs] = report().sections;
    const sections = Array.from({ length: 3 }, () => inputs ?? { heading: "", groups: [] });
    expect((await pages(await renderReport(report({ sections }), fonts))).length).toBe(2);
  });
});
