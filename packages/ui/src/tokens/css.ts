import { colorRoles, type ThemeTokens, themes, toKebab } from "./themes.ts";

function declarations(tokens: ThemeTokens, indent: string): string {
  return colorRoles
    .map((role) => `${indent}--gb-${toKebab(role)}: ${tokens[role].toLowerCase()};`)
    .join("\n");
}

/**
 * Renders the themes as CSS custom properties. `data-theme` on `<html>` is set before
 * first paint by the app; without it (no JavaScript) the OS preference decides.
 */
export function renderTokensCss(): string {
  return `/* Generated from src/tokens/themes.ts by scripts/build-tokens.ts. Do not edit. */

:root,
:root[data-theme="dark"] {
  color-scheme: dark;
${declarations(themes.dark, "  ")}
}

:root[data-theme="light"] {
  color-scheme: light;
${declarations(themes.light, "  ")}
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    color-scheme: light;
${declarations(themes.light, "    ")}
  }
}
`;
}
