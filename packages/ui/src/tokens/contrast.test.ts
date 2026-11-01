import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio, parseHex, relativeLuminance } from "./contrast.ts";
import { renderTokensCss } from "./css.ts";
import { colorRoles, contrastPairs, themeNames, themes, toKebab } from "./themes.ts";

describe("contrastRatio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    // #767676 on white is the classic 4.54:1 example.
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#FFB23E", "#0A0D10")).toBeCloseTo(contrastRatio("#0A0D10", "#FFB23E"), 9);
  });

  it("rejects colours it cannot measure", () => {
    expect(() => parseHex("rgba(0,0,0,0.5)")).toThrow();
  });
});

describe("design tokens", () => {
  it("keeps the concept's dark values from openspec/config.yaml", () => {
    expect(themes.dark).toMatchObject({
      ground: "#0A0D10",
      panel: "#12171C",
      line: "#26313B",
      fg: "#E6EBEF",
      fgDim: "#A3AEB9",
      amber: "#FFB23E",
      teal: "#4CD4C0",
    });
  });

  it("defines every role in both themes", () => {
    for (const name of themeNames) {
      expect(Object.keys(themes[name]).sort()).toEqual([...colorRoles].sort());
    }
  });

  for (const name of themeNames) {
    describe(`${name} theme`, () => {
      for (const pair of contrastPairs) {
        it(`${pair.usage} (${pair.text} on ${pair.background}) meets AA`, () => {
          const ratio = contrastRatio(themes[name][pair.text], themes[name][pair.background]);
          expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    });
  }

  it("tokens.css is up to date with themes.ts (run `pnpm --filter @gb/ui tokens`)", () => {
    const committed = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
    expect(committed).toBe(renderTokensCss());
  });

  it("theme.css exposes every colour role as a Tailwind colour", () => {
    const css = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");
    const shadowsOnly = new Set(["glowAmber", "glowTeal"]);
    for (const role of colorRoles.filter((name) => !shadowsOnly.has(name))) {
      expect(css).toContain(`--color-${toKebab(role)}: var(--gb-${toKebab(role)});`);
    }
  });
});
