/**
 * Oscilloscope design tokens: the single source of truth for colour.
 *
 * Both themes define the same roles. `scripts/build-tokens.ts` turns them into
 * `src/styles/tokens.css` (`--gb-<role>` custom properties); the Tailwind theme in
 * `src/styles/theme.css` maps each role to a utility colour. App code uses the
 * utilities (`bg-panel`, `text-fg-dim`, ...) and never raw hex values.
 *
 * Naming: `ground`/`inset`/`panel`/`raised`/`selected` are surfaces; `fg*` are text;
 * a signal colour `x` is a fill, `on-x` the text drawn on that fill, `x-ink` the
 * signal used as text or strokes on surfaces, and `x-soft` a tinted surface.
 */

export const themeNames = ["dark", "light"] as const;
export type ThemeName = (typeof themeNames)[number];

export const colorRoles = [
  "ground",
  "inset",
  "panel",
  "raised",
  "selected",
  "line",
  "lineStrong",
  "grid",
  "fg",
  "fgDim",
  "fgFaint",
  "amber",
  "onAmber",
  "amberInk",
  "amberSoft",
  "teal",
  "onTeal",
  "tealInk",
  "tealSoft",
  "tealLine",
  "adminInk",
  "adminSoft",
  "danger",
  "onDanger",
  "dangerInk",
  "dangerSoft",
  "infoInk",
  "infoSoft",
  "variantInk",
  "variantSoft",
  "blankInk",
  "blankSoft",
  "mode1",
  "mode1Soft",
  "mode2",
  "mode2Soft",
  "mode3",
  "mode3Soft",
  "focus",
  "overlay",
  "glowAmber",
  "glowTeal",
] as const;
export type ColorRole = (typeof colorRoles)[number];
export type ThemeTokens = Record<ColorRole, string>;

/** Dark is the default look: the concept's instrument panel (openspec/config.yaml). */
const dark: ThemeTokens = {
  ground: "#0A0D10",
  inset: "#0F1418",
  panel: "#12171C",
  raised: "#182029",
  selected: "#26313B",
  line: "#26313B",
  lineStrong: "#3A4651",
  grid: "#1C242C",
  fg: "#E6EBEF",
  fgDim: "#A3AEB9",
  fgFaint: "#8794A1",
  amber: "#FFB23E",
  onAmber: "#0A0D10",
  amberInk: "#FFB23E",
  amberSoft: "#1F1A12",
  teal: "#4CD4C0",
  onTeal: "#0A0D10",
  tealInk: "#4CD4C0",
  tealSoft: "#14272A",
  tealLine: "#2E5E58",
  adminInk: "#C9A2FF",
  adminSoft: "#1F1B2C",
  danger: "#FF6B63",
  onDanger: "#0A0D10",
  dangerInk: "#FF8B85",
  dangerSoft: "#2A1A1C",
  infoInk: "#7DB9FF",
  infoSoft: "#152131",
  variantInk: "#9AA9FF",
  variantSoft: "#191D34",
  blankInk: "#F293D8",
  blankSoft: "#2A1727",
  mode1: "#6CB6FF",
  mode1Soft: "#132233",
  mode2: "#5FE0A8",
  mode2Soft: "#11271F",
  mode3: "#F28CC8",
  mode3Soft: "#2A1726",
  focus: "#FFB23E",
  overlay: "rgba(5, 7, 9, 0.72)",
  glowAmber: "rgba(255, 178, 62, 0.35)",
  glowTeal: "rgba(76, 212, 192, 0.55)",
};

/**
 * Light counterpart: same roles, paper ground and white panels. Signal colours keep
 * their fills (dark text on amber and teal) and use deeper "ink" variants as text.
 */
const light: ThemeTokens = {
  ground: "#F3F5F7",
  inset: "#EAEEF1",
  panel: "#FFFFFF",
  raised: "#EEF1F4",
  selected: "#DCE2E8",
  line: "#D3DAE0",
  lineStrong: "#A5B0BA",
  grid: "#E3E8EC",
  fg: "#0D1318",
  fgDim: "#4A5663",
  fgFaint: "#5E6A76",
  amber: "#FFB23E",
  onAmber: "#0A0D10",
  amberInk: "#8A4F00",
  amberSoft: "#FFF3DF",
  teal: "#4CD4C0",
  onTeal: "#0A0D10",
  tealInk: "#06705F",
  tealSoft: "#E0F6F2",
  tealLine: "#7FD3C6",
  adminInk: "#7A3DB8",
  adminSoft: "#F2EAFB",
  danger: "#C4302B",
  onDanger: "#FFFFFF",
  dangerInk: "#B3261E",
  dangerSoft: "#FCE9E8",
  infoInk: "#1F5DAA",
  infoSoft: "#E5EFFA",
  variantInk: "#3A48B0",
  variantSoft: "#E9ECFB",
  blankInk: "#9C2A7D",
  blankSoft: "#FAE7F4",
  mode1: "#1D5FA8",
  mode1Soft: "#E6F0FB",
  mode2: "#0A7149",
  mode2Soft: "#E2F5EC",
  mode3: "#A3286E",
  mode3Soft: "#FBE8F2",
  focus: "#8A4F00",
  overlay: "rgba(13, 19, 24, 0.45)",
  glowAmber: "rgba(255, 178, 62, 0.45)",
  glowTeal: "rgba(6, 112, 95, 0.25)",
};

export const themes: Record<ThemeName, ThemeTokens> = { dark, light };

/** A text colour drawn on a background colour somewhere in the interface. */
export interface ContrastPair {
  text: ColorRole;
  background: ColorRole;
  usage: string;
}

const surfaces = ["ground", "inset", "panel", "raised"] as const;
const surfaceTexts = [
  "fg",
  "fgDim",
  "fgFaint",
  "amberInk",
  "tealInk",
  "adminInk",
  "dangerInk",
  "infoInk",
] as const;

/**
 * Every text/background pair the components use. Each must reach WCAG AA (4.5:1) in
 * both themes; `contrast.test.ts` enforces it. Add a pair here before using a new
 * combination.
 */
export const contrastPairs: readonly ContrastPair[] = [
  ...surfaces.flatMap((background) =>
    surfaceTexts.map((text) => ({ text, background, usage: `${text} text on ${background}` })),
  ),
  { text: "fg", background: "selected", usage: "active navigation entry and segment" },
  { text: "fgDim", background: "selected", usage: "secondary text in a selected row" },
  { text: "adminInk", background: "selected", usage: "active admin navigation entry" },
  { text: "amberInk", background: "selected", usage: "signal value in a selected row" },
  { text: "onAmber", background: "amber", usage: "primary button" },
  { text: "onTeal", background: "teal", usage: "completed badge and teal fill" },
  { text: "onDanger", background: "danger", usage: "danger button" },
  { text: "amberInk", background: "amberSoft", usage: "warning toast and amber chip" },
  { text: "tealInk", background: "tealSoft", usage: "success toast and completed chip" },
  { text: "adminInk", background: "adminSoft", usage: "admin chip" },
  { text: "dangerInk", background: "dangerSoft", usage: "error toast and field error" },
  { text: "infoInk", background: "infoSoft", usage: "info toast" },
  { text: "fg", background: "amberSoft", usage: "toast and callout body text" },
  { text: "fg", background: "tealSoft", usage: "toast body text" },
  { text: "fg", background: "dangerSoft", usage: "toast body text" },
  { text: "fg", background: "infoSoft", usage: "toast body text" },
  { text: "fg", background: "adminSoft", usage: "admin callout body text" },
  { text: "fgDim", background: "tealSoft", usage: "step number on a completed step" },
  { text: "fgDim", background: "amberSoft", usage: "step number on a ready step" },
  { text: "fg", background: "variantSoft", usage: "label of a CL, SS or BOBO step" },
  { text: "fgDim", background: "variantSoft", usage: "step number of a CL, SS or BOBO step" },
  { text: "variantInk", background: "variantSoft", usage: "variant highlight mark" },
  { text: "variantInk", background: "panel", usage: "variant highlight in the legend" },
  { text: "fg", background: "blankSoft", usage: "label of a bridge-blank step" },
  { text: "fgDim", background: "blankSoft", usage: "step number of a bridge-blank step" },
  { text: "blankInk", background: "blankSoft", usage: "bridge-blank highlight mark" },
  { text: "blankInk", background: "panel", usage: "bridge-blank highlight in the legend" },
  ...(["mode1", "mode2", "mode3"] as const).flatMap((mode) => [
    ...surfaces.map((background) => ({
      text: mode,
      background,
      usage: `${mode} body mode label on ${background}`,
    })),
    { text: mode, background: `${mode}Soft` as const, usage: `${mode} name on its chosen tile` },
    {
      text: "fg" as const,
      background: `${mode}Soft` as const,
      usage: `reading on a chosen ${mode} tile`,
    },
    {
      text: "fgDim" as const,
      background: `${mode}Soft` as const,
      usage: `detail on a chosen ${mode} tile`,
    },
  ]),
];

/** `amberInk` → `amber-ink`, used for CSS custom properties and utility names. */
export function toKebab(role: string): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
