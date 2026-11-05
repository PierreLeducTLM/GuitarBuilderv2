// Conformance of the template module and the step labels with the build-sequence spec:
// the spec text is parsed here, so the template, the spec and both catalogs cannot
// drift apart.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { isStepKey, STEP_KEYS, stepNumberLabel, TEMPLATE_ARROWS, TEMPLATE_STEPS } from "./template";

const spec = readFileSync(
  fileURLToPath(new URL("../../../../../openspec/specs/build-sequence/spec.md", import.meta.url)),
  "utf8",
);

/** Each "Template Group ..." requirement's body. */
function groupRequirements(): { title: string; body: string }[] {
  const pattern = /^### Requirement: Template Group (.+?)\n([\s\S]*?)(?=^### Requirement:)/gm;
  return [...spec.matchAll(pattern)].map((match) => ({
    title: match[1] as string,
    body: match[2] as string,
  }));
}

function specSteps(): { key: string; label: string; group: number }[] {
  const steps: { key: string; label: string; group: number }[] = [];
  let group = 0;
  for (const { title, body } of groupRequirements()) {
    // Template Group Names names the groups; it holds no steps.
    if (title === "Names") continue;
    // The bridge's classical branch continues group 9.
    if (title !== "Bridge Classical Branch") group++;
    const list = body.split("#### Scenario")[0] as string;
    for (const match of list.matchAll(/^- (\w+): (.+)$/gm)) {
      steps.push({ key: match[1] as string, label: match[2] as string, group });
    }
  }
  return steps;
}

function specFrenchLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const line of spec.matchAll(/the steps are labelled (.+)$/gm)) {
    for (const pair of (line[1] as string).matchAll(/(\w+) "([^"]*)"/g)) {
      labels[pair[1] as string] = pair[2] as string;
    }
  }
  return labels;
}

function specArrows(): string[] {
  const arrows: string[] = [];
  for (const line of spec.matchAll(/\*\*THEN\*\* arrows connect (.+)$/gm)) {
    for (const chain of (line[1] as string).split(/, (?:and )?| and /)) {
      const parts = chain.split("→").map((part) => part.trim());
      for (let i = 0; i + 1 < parts.length; i++) {
        const arrow = `${parts[i]} → ${parts[i + 1]}`;
        if (!arrows.includes(arrow)) arrows.push(arrow);
      }
    }
  }
  return arrows;
}

function specList(sentence: RegExp): string[] {
  const match = spec.match(sentence);
  if (!match) throw new Error(`Not found in the spec: ${sentence}`);
  return (match[1] as string).split(/,\s*(?:and\s+)?|\s+and\s+/).map((key) => key.trim());
}

describe("default step template", () => {
  it("has the spec's 132 steps in canonical order, numbered 1-132, in 15 groups", () => {
    const steps = specSteps();
    expect(steps).toHaveLength(132);
    expect(TEMPLATE_STEPS.map((step) => step.key)).toEqual(steps.map((step) => step.key));
    expect([...STEP_KEYS]).toEqual(steps.map((step) => step.key));
    expect(TEMPLATE_STEPS.map((step) => step.number)).toEqual(steps.map((_, index) => index + 1));
    expect(TEMPLATE_STEPS.map((step) => step.group)).toEqual(steps.map((step) => step.group));
    expect(Math.max(...TEMPLATE_STEPS.map((step) => step.group))).toBe(15);
  });

  it("has every connection and cross-group arrow of the spec, and no other", () => {
    const arrows = specArrows();
    expect(arrows).toHaveLength(144);
    expect(TEMPLATE_ARROWS.map(([from, to]) => `${from} → ${to}`)).toEqual(arrows);
    for (const [from, to] of TEMPLATE_ARROWS) {
      expect(isStepKey(from) && isStepKey(to)).toBe(true);
    }
  });

  it("starts at the 10 component steps and ends at OptimiseAcoustic", () => {
    const targets = new Set(TEMPLATE_ARROWS.map(([, to]) => to));
    const sources = new Set(TEMPLATE_ARROWS.map(([from]) => from));
    expect(STEP_KEYS.filter((key) => !targets.has(key))).toEqual([
      "TrussRod",
      "Fretboard",
      "Neck",
      "TopPanel",
      "BraceBridgePlate",
      "BackPanel",
      "SidesBindings",
      "EndBlockLinings",
      "Bridge",
      "NutSaddle",
    ]);
    expect(STEP_KEYS.filter((key) => !sources.has(key))).toEqual(["OptimiseAcoustic"]);
  });

  it("marks the variant-specific steps the spec lists", () => {
    const steelString = specList(/these 12 steps apply only to steel-string builds: (.+)$/m);
    const classical = specList(/these 10 steps apply only to classical builds: (.+)$/m);
    const bobo = specList(
      /these 6 steps apply only to builds with a BOBO neck, of either guitar type: (.+)$/m,
    );
    const by = (predicate: (step: (typeof TEMPLATE_STEPS)[number]) => boolean) =>
      TEMPLATE_STEPS.filter(predicate).map((step) => step.key);

    expect(by((step) => step.guitarType === "steel_string")).toEqual(
      STEP_KEYS.filter((key) => steelString.includes(key)),
    );
    expect(by((step) => step.guitarType === "classical")).toEqual(
      STEP_KEYS.filter((key) => [...classical, "CLGlueBOBO1", "CLCutBOBO"].includes(key)),
    );
    expect(by((step) => step.needsBobo)).toEqual(
      STEP_KEYS.filter((key) => [...bobo, "CLGlueBOBO1", "CLCutBOBO"].includes(key)),
    );
  });

  it("highlights the variant steps and the two bridge-blank steps", () => {
    const variant = specList(
      /These are the steps whose label starts with "CL", "SS" or "BOBO": (.+?)\. The two/m,
    );
    const by = (highlight: string | null) =>
      TEMPLATE_STEPS.filter((step) => step.highlight === highlight).map((step) => step.key);
    expect(by("variant").sort()).toEqual([...variant].sort());
    expect(by("bridgeBlank")).toEqual(["FabricateBridge", "FabricateCLBridge"]);
    for (const key of variant) {
      expect(en.steps[key as keyof typeof en.steps]).toMatch(/^(CL|SS|BOBO) /);
    }
  });
});

describe("step labels", () => {
  it("has the spec's English label for every step", () => {
    const expected = Object.fromEntries(specSteps().map((step) => [step.key, step.label]));
    expect(en.steps).toEqual(expected);
  });

  it("has the spec's French label for every step", () => {
    const expected = specFrenchLabels();
    expect(Object.keys(expected)).toHaveLength(132);
    expect(fr.steps).toEqual(expected);
  });

  it("keeps labels that the spec lets repeat, distinguished by key", () => {
    const counts = new Map<string, number>();
    for (const label of Object.values(en.steps)) counts.set(label, (counts.get(label) ?? 0) + 1);
    const repeated = [...counts].filter(([, count]) => count > 1).map(([label]) => label);
    expect(repeated.sort()).toEqual([
      "Cut to rectangle outline",
      "Cut to side profile",
      "Shape bridge wings",
    ]);
  });
});

describe("stepNumberLabel", () => {
  it("pads template positions to three digits (Step Numbers)", () => {
    expect(stepNumberLabel(7)).toBe("007");
    expect(stepNumberLabel(36)).toBe("036");
    expect(stepNumberLabel(132)).toBe("132");
  });
});
