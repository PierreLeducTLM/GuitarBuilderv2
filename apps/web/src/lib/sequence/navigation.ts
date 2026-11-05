// Moving between steps on the step screen (build-sequence: Step Context, Step
// Navigation).
import { groupOf, type TemplateGroup } from "./groups";
import { type StepStates, stepState, stepStatus } from "./state";
import type { StepKey } from "./template";
import type { DisplayGraph } from "./variant";

export interface ContextLink {
  key: StepKey;
  /** The linked step's group when it differs from the step's own group, else null. */
  group: TemplateGroup | null;
}

export interface StepContext {
  /** Displayed predecessors, in arrow order, with their completion. */
  after: readonly (ContextLink & { completed: boolean })[];
  /** Displayed successors, in arrow order. */
  leadsTo: readonly ContextLink[];
  /** No displayed predecessor: the step starts its group. */
  starting: boolean;
  /** No displayed successor: the last step of the build. */
  last: boolean;
}

/** What a step comes after and what it leads to, in a build's display graph. */
export function stepContext(graph: DisplayGraph, states: StepStates, key: StepKey): StepContext {
  const own = groupOf(key);
  const link = (other: StepKey): ContextLink => {
    const group = groupOf(other);
    return { key: other, group: group === own ? null : group };
  };
  const after = (graph.predecessors.get(key) ?? []).map((from) => ({
    ...link(from),
    completed: stepState(states, from).completed,
  }));
  const leadsTo = graph.arrows.filter(([from]) => from === key).map(([, to]) => link(to));
  return { after, leadsTo, starting: after.length === 0, last: leadsTo.length === 0 };
}

/** The displayed steps before and after `key` in template order. */
export function stepNeighbours(
  graph: DisplayGraph,
  key: StepKey,
): { previous: StepKey | null; next: StepKey | null } {
  const index = graph.steps.findIndex((step) => step.key === key);
  return {
    previous: graph.steps[index - 1]?.key ?? null,
    next: graph.steps[index + 1]?.key ?? null,
  };
}

/**
 * Where "Done, next step" goes once `key` is completed: the first ready step after it in
 * template order, else the build's first ready step, else nowhere (the Steps view).
 */
export function nextAfterDone(
  graph: DisplayGraph,
  states: StepStates,
  key: StepKey,
): StepKey | null {
  const done: StepStates = { ...states, [key]: { ...stepState(states, key), completed: true } };
  const ready = graph.steps.filter((step) => stepStatus(graph, done, step.key) === "ready");
  const index = graph.steps.findIndex((step) => step.key === key);
  const after = ready.find((step) => graph.steps.indexOf(step) > index);
  return (after ?? ready[0])?.key ?? null;
}
