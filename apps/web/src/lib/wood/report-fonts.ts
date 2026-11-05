/**
 * The PDF report's fonts, fetched from `public/` only when a report is generated
 * (wood-panel-calculator design decision 7). Words are set in Space Grotesk; numbers,
 * units and symbols in JetBrains Mono, which also has the Greek "ρ" Space Grotesk lacks.
 */
export const REPORT_FONTS = {
  words: {
    regular: "/fonts/pdf/SpaceGrotesk-Regular.ttf",
    bold: "/fonts/pdf/SpaceGrotesk-Bold.ttf",
  },
  figures: {
    regular: "/fonts/pdf/JetBrainsMono-Regular.ttf",
    bold: "/fonts/pdf/JetBrainsMono-Bold.ttf",
  },
} as const;

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x202f);

/**
 * Every character a value, unit or symbol in the report can hold, in English or French
 * number formats once passed through `figureText`.
 */
export const FIGURE_CHARACTERS = `0123456789.,+-–=/()_ ${NO_BREAK_SPACE}³ρABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`;

/** French digit grouping uses a narrow no-break space, which Mono lacks; a no-break space keeps the group together. */
export const figureText = (text: string) => text.replaceAll(NARROW_NO_BREAK_SPACE, NO_BREAK_SPACE);
