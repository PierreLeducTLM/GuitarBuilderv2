// One group's part flow: its displayed steps in layers, top to bottom, the connectors
// between them, and the links to and from other groups (build-sequence: Part Flow,
// Part Flow Layout).
import { groupOf, type TemplateGroup } from "./groups";
import type { StepKey, TemplateStep } from "./template";
import type { DisplayGraph } from "./variant";

export interface FlowPoint {
  key: StepKey;
  row: number;
  column: number;
}

/** An arrow between two steps of the group; `skips` when it passes over a row. */
export interface FlowEdge {
  from: FlowPoint;
  to: FlowPoint;
  skips: boolean;
}

/** An arrow between a step of the group (`step`) and a step of another group. */
export interface FlowLink {
  step: StepKey;
  other: StepKey;
  otherGroup: TemplateGroup;
}

export interface PartFlow {
  /** Layers, top to bottom; each in template order. */
  rows: readonly (readonly TemplateStep[])[];
  edges: readonly FlowEdge[];
  /** Arrows from other groups into this one, in arrow order. */
  entries: readonly FlowLink[];
  /** Arrows from this group to others, in arrow order. */
  exits: readonly FlowLink[];
}

/**
 * Each step's layer: one below its lowest predecessor from the same group. A step may
 * come before one of its predecessors in template order, so layers follow the arrows.
 */
function layers(graph: DisplayGraph, steps: readonly TemplateStep[]): Map<StepKey, number> {
  const inGroup = new Set(steps.map((step) => step.key));
  const layer = new Map<StepKey, number>();
  const layerOf = (key: StepKey): number => {
    const known = layer.get(key);
    if (known !== undefined) return known;
    const predecessors = (graph.predecessors.get(key) ?? []).filter((from) => inGroup.has(from));
    const value = Math.max(-1, ...predecessors.map(layerOf)) + 1;
    layer.set(key, value);
    return value;
  };
  for (const step of steps) layerOf(step.key);
  return layer;
}

/** The part flow of group `groupId` in a build's display graph. */
export function partFlow(graph: DisplayGraph, groupId: number): PartFlow {
  const steps = graph.steps.filter((step) => step.group === groupId);
  const layer = layers(graph, steps);
  // Longest-path layers are contiguous from 0, so there is one row per distinct layer.
  const rows = Array.from({ length: new Set(layer.values()).size }, (_, row) =>
    steps.filter((step) => layer.get(step.key) === row),
  );
  const point = (key: StepKey): FlowPoint => {
    const row = layer.get(key) ?? 0;
    return { key, row, column: rows[row]?.findIndex((step) => step.key === key) ?? 0 };
  };
  const inGroup = (key: StepKey) => layer.has(key);

  const edges = graph.arrows
    .filter(([from, to]) => inGroup(from) && inGroup(to))
    .map(([from, to]) => {
      const edge = { from: point(from), to: point(to) };
      return { ...edge, skips: edge.to.row - edge.from.row > 1 };
    });
  const entries = graph.arrows
    .filter(([from, to]) => !inGroup(from) && inGroup(to))
    .map(([from, to]) => ({ step: to, other: from, otherGroup: groupOf(from) }));
  const exits = graph.arrows
    .filter(([from, to]) => inGroup(from) && !inGroup(to))
    .map(([from, to]) => ({ step: from, other: to, otherGroup: groupOf(to) }));
  return { rows, edges, entries, exits };
}
