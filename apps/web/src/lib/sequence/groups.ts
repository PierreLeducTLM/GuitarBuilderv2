// The 15 groups of the step template (build-sequence: Template Group Names). Names
// live in the message catalogs under `groups.<messageKey>`.
import { type StepKey, templateStep } from "./template";

export const TEMPLATE_GROUPS = [
  { id: 1, key: "truss-rod", messageKey: "trussRod", assembly: false },
  { id: 2, key: "fretboard", messageKey: "fretboard", assembly: false },
  { id: 3, key: "neck", messageKey: "neck", assembly: false },
  { id: 4, key: "top-panel", messageKey: "topPanel", assembly: false },
  { id: 5, key: "braces", messageKey: "braces", assembly: false },
  { id: 6, key: "back-panel", messageKey: "backPanel", assembly: false },
  { id: 7, key: "sides", messageKey: "sides", assembly: false },
  { id: 8, key: "end-blocks", messageKey: "endBlocks", assembly: false },
  { id: 9, key: "bridge", messageKey: "bridge", assembly: false },
  { id: 10, key: "nut-saddle", messageKey: "nutSaddle", assembly: false },
  { id: 11, key: "neck-assembly", messageKey: "neckAssembly", assembly: true },
  { id: 12, key: "body-finish", messageKey: "bodyFinish", assembly: true },
  { id: 13, key: "heel-assembly", messageKey: "heelAssembly", assembly: true },
  { id: 14, key: "body-assembly", messageKey: "bodyAssembly", assembly: true },
  { id: 15, key: "final-assembly", messageKey: "finalAssembly", assembly: true },
] as const;

export type TemplateGroup = (typeof TEMPLATE_GROUPS)[number];
export type GroupKey = TemplateGroup["key"];
export type GroupMessageKey = TemplateGroup["messageKey"];

/** The group with this URL key, or undefined for anything else. */
export function groupByKey(key: string): TemplateGroup | undefined {
  return TEMPLATE_GROUPS.find((group) => group.key === key);
}

/** The group a step belongs to. */
export function groupOf(key: StepKey): TemplateGroup {
  const { group } = templateStep(key);
  return TEMPLATE_GROUPS[group - 1] as TemplateGroup;
}
