// Conformance of the group module and the group names with build-sequence: Template
// Group Names. Until the change is archived the requirement lives in its delta spec.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { groupByKey, groupOf, TEMPLATE_GROUPS } from "./groups";
import { TEMPLATE_STEPS } from "./template";

/** The nearest folder above this file that holds `openspec/`. */
function repoRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  if (existsSync(join(from, "openspec"))) return from;
  const parent = dirname(from);
  if (parent === from) throw new Error("openspec/ not found above the test");
  return repoRoot(parent);
}

const specPaths = [
  "openspec/specs/build-sequence/spec.md",
  "openspec/changes/workbench-shell-and-steps/specs/build-sequence/spec.md",
].map((path) => join(repoRoot(), path));

function specGroupNames(): { key: string; en: string; fr: string }[] {
  for (const path of specPaths.filter((candidate) => existsSync(candidate))) {
    const match = readFileSync(path, "utf8").match(
      /^### Requirement: Template Group Names\n[\s\S]*?\*\*THEN\*\* they are: (.+)$/m,
    );
    if (!match) continue;
    return (match[1] as string).split("; ").map((entry) => {
      const parts = entry.match(/^([a-z-]+), "([^"]+)", "([^"]+)"$/);
      if (!parts) throw new Error(`Unreadable group entry: ${entry}`);
      return { key: parts[1] as string, en: parts[2] as string, fr: parts[3] as string };
    });
  }
  throw new Error("Template Group Names not found in the build-sequence spec");
}

describe("template groups", () => {
  it("are the spec's 15 groups, in group order, with their URL keys", () => {
    expect(TEMPLATE_GROUPS.map((group) => group.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    expect(TEMPLATE_GROUPS.map((group) => group.key)).toEqual(specGroupNames().map((g) => g.key));
  });

  it("have the spec's English and French names", () => {
    const names = (messages: typeof en) =>
      TEMPLATE_GROUPS.map((group) => messages.groups[group.messageKey]);
    expect(names(en)).toEqual(specGroupNames().map((g) => g.en));
    expect(names(fr)).toEqual(specGroupNames().map((g) => g.fr));
  });

  it("hold every template step", () => {
    const ids = new Set<number>(TEMPLATE_GROUPS.map((group) => group.id));
    expect(TEMPLATE_STEPS.every((step) => ids.has(step.group))).toBe(true);
  });

  it("are found by URL key", () => {
    expect(groupByKey("top-panel")?.id).toBe(4);
    expect(groupByKey("final-assembly")?.id).toBe(15);
    expect(groupByKey("Top-Panel")).toBeUndefined();
    expect(groupByKey("no-such-group")).toBeUndefined();
  });

  it("give each step its group", () => {
    expect(groupOf("TrussRod").key).toBe("truss-rod");
    expect(groupOf("FitTopBack").key).toBe("body-assembly");
    expect(groupOf("ShapeMarkString").key).toBe("bridge");
  });

  it("tell component groups from assembly groups", () => {
    expect(TEMPLATE_GROUPS.filter((group) => group.assembly).map((group) => group.id)).toEqual([
      11, 12, 13, 14, 15,
    ]);
  });
});
