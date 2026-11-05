// The build map: the 15 template groups with their progress and the groups that feed
// them (build-sequence: Build Map, Steps Checklist).
import { TEMPLATE_GROUPS, type TemplateGroup } from "./groups";
import { type StepStates, stepState, stepStatus } from "./state";
import { type TemplateStep, templateStep } from "./template";
import type { DisplayGraph } from "./variant";

export type GroupState = "done" | "ready" | "notStarted";

export interface GroupSummary {
  group: TemplateGroup;
  /** The group's displayed steps, in template order. */
  steps: readonly TemplateStep[];
  completed: number;
  total: number;
  state: GroupState;
  /** Groups with an arrow into this one, in group order. */
  feeds: readonly TemplateGroup[];
}

export interface GroupMap {
  /** Component groups, in group order. */
  parts: readonly GroupSummary[];
  /** Assembly groups, each after every group that feeds it. */
  assembly: readonly GroupSummary[];
}

function feedsOf(graph: DisplayGraph, group: TemplateGroup): TemplateGroup[] {
  const ids = new Set(
    graph.arrows
      .map(([from, to]) => [templateStep(from).group, templateStep(to).group] as const)
      .filter(([from, to]) => to === group.id && from !== group.id)
      .map(([from]) => from),
  );
  return TEMPLATE_GROUPS.filter((candidate) => ids.has(candidate.id));
}

function summarize(graph: DisplayGraph, states: StepStates, group: TemplateGroup): GroupSummary {
  const steps = graph.steps.filter((step) => step.group === group.id);
  const completed = steps.filter((step) => stepState(states, step.key).completed).length;
  const ready = steps.some((step) => stepStatus(graph, states, step.key) === "ready");
  const state: GroupState = completed === steps.length ? "done" : ready ? "ready" : "notStarted";
  return { group, steps, completed, total: steps.length, state, feeds: feedsOf(graph, group) };
}

/** How many groups lie upstream of `summary` on its longest chain of feeding groups. */
function depth(summary: GroupSummary, all: readonly GroupSummary[]): number {
  const upstream = summary.feeds.map((feed) => all.find((other) => other.group === feed));
  return Math.max(0, ...upstream.map((other) => (other ? depth(other, all) + 1 : 0)));
}

/**
 * Every group of the build with its progress: parts first, then assembly groups by depth
 * (a stable sort, so groups at the same depth keep their group order).
 */
export function groupGraph(graph: DisplayGraph, states: StepStates): GroupMap {
  const all = TEMPLATE_GROUPS.map((group) => summarize(graph, states, group));
  const assembly = all
    .filter((summary) => summary.group.assembly)
    .map((summary) => ({ summary, depth: depth(summary, all) }))
    .sort((left, right) => left.depth - right.depth)
    .map(({ summary }) => summary);
  return { parts: all.filter((summary) => !summary.group.assembly), assembly };
}
