// Which template steps a build shows, and the arrows between them
// (build-sequence: Step Applicability by Variant, Hidden Step Bridging).
import type { GuitarType } from "@gb/db";
import { type StepKey, TEMPLATE_ARROWS, TEMPLATE_STEPS, type TemplateStep } from "./template";

/** A build's construction variant (guitar-builds: Change Construction Variant). */
export interface BuildVariant {
  guitarType: GuitarType | null;
  boboNeck: boolean;
}

export type Arrow = readonly [StepKey, StepKey];

/** The steps a build shows, in template order, and the arrows drawn between them. */
export interface DisplayGraph {
  steps: readonly TemplateStep[];
  arrows: readonly Arrow[];
  /** Displayed predecessors of each displayed step. */
  predecessors: ReadonlyMap<StepKey, readonly StepKey[]>;
}

/**
 * Whether a step applies to a variant. A step is hidden when it needs a BOBO neck the
 * build does not have, or belongs to the other guitar type. When the guitar type is not
 * set, no step is hidden for its guitar type.
 */
export function stepApplies(step: TemplateStep, variant: BuildVariant): boolean {
  if (step.needsBobo && !variant.boboNeck) return false;
  if (step.guitarType && variant.guitarType && step.guitarType !== variant.guitarType) return false;
  return true;
}

function reachable(
  from: StepKey,
  to: StepKey,
  arrows: readonly Arrow[],
  skip: Arrow | null,
): boolean {
  const next = new Map<StepKey, StepKey[]>();
  for (const arrow of arrows) {
    if (arrow === skip) continue;
    const list = next.get(arrow[0]);
    if (list) list.push(arrow[1]);
    else next.set(arrow[0], [arrow[1]]);
  }
  const seen = new Set<StepKey>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const current = stack.pop() as StepKey;
    for (const target of next.get(current) ?? []) {
      if (target === to) return true;
      if (!seen.has(target)) {
        seen.add(target);
        stack.push(target);
      }
    }
  }
  return false;
}

function computeDisplayGraph(variant: BuildVariant): DisplayGraph {
  const order = new Map(TEMPLATE_STEPS.map((step, index) => [step.key, index]));
  const visible = new Set(
    TEMPLATE_STEPS.filter((step) => stepApplies(step, variant)).map((step) => step.key),
  );
  const successors = new Map<StepKey, StepKey[]>();
  const predecessors = new Map<StepKey, StepKey[]>();
  for (const [from, to] of TEMPLATE_ARROWS) {
    successors.set(from, [...(successors.get(from) ?? []), to]);
    predecessors.set(to, [...(predecessors.get(to) ?? []), from]);
  }
  // The visible steps reached from a step through hidden ones, in either direction.
  const visibleThrough = (key: StepKey, links: Map<StepKey, StepKey[]>): StepKey[] => {
    const found = new Set<StepKey>();
    const walk = (current: StepKey) => {
      for (const linked of links.get(current) ?? []) {
        if (visible.has(linked)) found.add(linked);
        else walk(linked);
      }
    };
    walk(key);
    return [...found].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  };

  const direct: Arrow[] = TEMPLATE_ARROWS.filter(
    ([from, to]) => visible.has(from) && visible.has(to),
  );
  const hasArrow = (list: readonly Arrow[], from: StepKey, to: StepKey) =>
    list.some(([a, b]) => a === from && b === to);

  // Bridge every hidden step: each visible predecessor to each visible successor.
  const bridges: Arrow[] = [];
  for (const step of TEMPLATE_STEPS) {
    if (visible.has(step.key)) continue;
    for (const from of visibleThrough(step.key, predecessors)) {
      for (const to of visibleThrough(step.key, successors)) {
        if (!hasArrow(direct, from, to) && !hasArrow(bridges, from, to)) bridges.push([from, to]);
      }
    }
  }
  // Leave out a bridge whose target is already reachable from its source through the
  // other displayed arrows, in template order.
  const kept = [...bridges];
  for (const bridge of bridges) {
    if (reachable(bridge[0], bridge[1], [...direct, ...kept], bridge)) {
      kept.splice(kept.indexOf(bridge), 1);
    }
  }

  const arrows = [...direct, ...kept];
  const displayedPredecessors = new Map<StepKey, StepKey[]>();
  for (const [from, to] of arrows) {
    displayedPredecessors.set(to, [...(displayedPredecessors.get(to) ?? []), from]);
  }
  return {
    steps: TEMPLATE_STEPS.filter((step) => visible.has(step.key)),
    arrows,
    predecessors: displayedPredecessors,
  };
}

const cache = new Map<string, DisplayGraph>();

/** The displayed steps and arrows for a variant (computed once per variant). */
export function displayGraph(variant: BuildVariant): DisplayGraph {
  const key = `${variant.guitarType ?? "unset"}:${variant.boboNeck}`;
  let graph = cache.get(key);
  if (!graph) {
    graph = computeDisplayGraph(variant);
    cache.set(key, graph);
  }
  return graph;
}
