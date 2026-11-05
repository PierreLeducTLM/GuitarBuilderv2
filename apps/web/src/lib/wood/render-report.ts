import { themes } from "@gb/ui/tokens";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, type PDFPage, type RGB, rgb } from "pdf-lib";
import type { ReportContent } from "./report";
import { figureText } from "./report-fonts";

type FontFiles = { regular: Uint8Array; bold: Uint8Array };

export interface ReportFontFiles {
  words: FontFiles;
  figures: FontFiles;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = (20 / 25.4) * 72;

const color = (hex: string): RGB =>
  rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );

const INK = {
  text: color(themes.light.fg),
  dim: color(themes.light.fgDim),
  accent: color(themes.light.amberInk),
  rule: color(themes.light.line),
};

/** A font and the one that draws the characters it lacks, such as "ρ" in Space Grotesk. */
type Face = { font: PDFFont; fallback: PDFFont; has: ReadonlySet<number> };

const face = (font: PDFFont, fallback: PDFFont): Face => ({
  font,
  fallback,
  has: new Set(font.getCharacterSet()),
});

/** Splits text into runs drawn by the primary font, or by the fallback where it lacks a glyph. */
export const splitRuns = (text: string, hasGlyph: (codePoint: number) => boolean) => {
  const list: { primary: boolean; text: string }[] = [];
  for (const character of figureText(text)) {
    const primary = hasGlyph(character.codePointAt(0) ?? 0);
    const last = list.at(-1);
    if (last && last.primary === primary) last.text += character;
    else list.push({ primary, text: character });
  }
  return list;
};

const runs = (text: string, { font, fallback, has }: Face) =>
  splitRuns(text, (codePoint) => has.has(codePoint)).map((run) => ({
    font: run.primary ? font : fallback,
    text: run.text,
  }));

const widthOf = (text: string, typeface: Face, size: number) =>
  runs(text, typeface).reduce(
    (width, run) => width + run.font.widthOfTextAtSize(run.text, size),
    0,
  );

/** Breaks a paragraph into lines no wider than `width`, at spaces; a longer word keeps its own line. */
export const wrap = (paragraph: string, measure: (text: string) => number, width: number) => {
  const lines: string[] = [];
  for (const word of paragraph.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    const candidate = last === undefined ? word : `${last} ${word}`;
    if (last !== undefined && measure(candidate) > width) lines.push(word);
    else lines.splice(-1, 1, candidate);
  }
  return lines;
};

/**
 * wood-panel-properties: PDF Report Contents laid out on A4 with 20 mm margins. Words are
 * set in Space Grotesk, values in JetBrains Mono; content continues on further pages and
 * the analysis, when there is one, starts a page of its own.
 */
export async function renderReport(
  content: ReportContent,
  fonts: ReportFontFiles,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${content.title} – ${content.panelName}`);
  const [words, wordsBold, figures, figuresBold] = await Promise.all([
    pdf.embedFont(fonts.words.regular, { subset: true }),
    pdf.embedFont(fonts.words.bold, { subset: true }),
    pdf.embedFont(fonts.figures.regular, { subset: true }),
    pdf.embedFont(fonts.figures.bold, { subset: true }),
  ]);
  const body = face(words, figures);
  const strong = face(wordsBold, figuresBold);
  const value = face(figures, figures);

  const [pageWidth, pageHeight] = A4;
  const right = pageWidth - MARGIN;
  const top = pageHeight - MARGIN;
  const layout = { page: pdf.addPage(A4), y: top };

  const newPage = () => {
    layout.page = pdf.addPage(A4);
    layout.y = top;
  };
  const room = (height: number) => {
    if (layout.y - height < MARGIN) newPage();
  };
  const draw = (page: PDFPage, text: string, x: number, size: number, typeface: Face, ink: RGB) =>
    runs(text, typeface).reduce((left, run) => {
      page.drawText(run.text, { x: left, y: layout.y, size, font: run.font, color: ink });
      return left + run.font.widthOfTextAtSize(run.text, size);
    }, x);
  const line = (text: string, size: number, typeface: Face, ink: RGB, after: number) => {
    room(size);
    draw(layout.page, text, MARGIN, size, typeface, ink);
    layout.y -= after;
  };

  line(content.title, 20, strong, INK.text, 28);
  line(content.panelName, 14, strong, INK.accent, 20);
  line(content.generated, 10, body, INK.dim, 28);

  for (const section of content.sections) {
    room(48);
    line(section.heading, 14, strong, INK.text, 8);
    layout.page.drawLine({
      start: { x: MARGIN, y: layout.y },
      end: { x: right, y: layout.y },
      thickness: 0.75,
      color: INK.rule,
    });
    layout.y -= 18;
    for (const group of section.groups) {
      room(32);
      line(group.heading, 11, strong, INK.dim, 16);
      for (const row of group.rows) {
        room(15);
        draw(layout.page, row.label, MARGIN, 10, body, INK.text);
        draw(layout.page, row.value, right - widthOf(row.value, value, 10), 10, value, INK.text);
        layout.y -= 15;
      }
      layout.y -= 8;
    }
    layout.y -= 8;
  }

  if (content.analysis) {
    newPage();
    line(content.analysis.heading, 14, strong, INK.text, 24);
    for (const paragraph of content.analysis.paragraphs) {
      for (const text of wrap(
        paragraph,
        (candidate) => widthOf(candidate, body, 10),
        right - MARGIN,
      ))
        line(text, 10, body, INK.text, 14);
      layout.y -= 8;
    }
  }

  return pdf.save();
}
