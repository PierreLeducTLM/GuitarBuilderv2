// The database decides which steps a shared story returns with public.step_applies().
// Its key lists must say what the step template says (build-sequence: Step
// Applicability by Variant), so a template change without a matching migration fails.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TEMPLATE_STEPS } from "@/lib/sequence/template";

/** The nearest folder above this file that holds `supabase/migrations/`. */
function repoRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  if (existsSync(join(from, "supabase", "migrations"))) return from;
  const parent = dirname(from);
  if (parent === from) throw new Error("supabase/migrations not found above the test");
  return repoRoot(parent);
}

/** The variant rules of the latest migration that defines them. */
function sqlVariantRules(): string {
  const folder = join(repoRoot(), "supabase", "migrations");
  const rules = readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => readFileSync(join(folder, name), "utf8"))
    .map((sql) => sql.match(/-- step-variant-rules:begin([\s\S]*?)-- step-variant-rules:end/))
    .filter((match) => match !== null)
    .map((match) => match[1] as string);
  const latest = rules.at(-1);
  if (latest === undefined) throw new Error("No migration defines the step variant rules");
  return latest;
}

function keyList(rules: string, condition: string): string[] {
  const start = rules.indexOf(condition);
  if (start < 0) throw new Error(`Variant rule not found: ${condition}`);
  const list = rules.slice(start).match(/array\[([^\]]*)\]/);
  if (!list) throw new Error(`Key list not found after: ${condition}`);
  return [...(list[1] as string).matchAll(/'([A-Za-z0-9]+)'/g)].map((key) => key[1] as string);
}

const sorted = (keys: readonly string[]) => [...keys].sort();
const keysWhere = (test: (step: (typeof TEMPLATE_STEPS)[number]) => boolean) =>
  sorted(TEMPLATE_STEPS.filter(test).map((step) => step.key));

describe("step variant rules in the database", () => {
  const rules = sqlVariantRules();

  it("hides the template's BOBO-only steps on builds without a BOBO neck", () => {
    expect(sorted(keyList(rules, "not p_bobo"))).toEqual(keysWhere((step) => step.needsBobo));
  });

  it("hides the template's steel-string steps on classical builds", () => {
    expect(sorted(keyList(rules, "'classical'"))).toEqual(
      keysWhere((step) => step.guitarType === "steel_string"),
    );
  });

  it("hides the template's classical steps on steel-string builds", () => {
    expect(sorted(keyList(rules, "'steel_string'"))).toEqual(
      keysWhere((step) => step.guitarType === "classical"),
    );
  });
});
