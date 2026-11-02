// Automatic left-to-right layered layout of the diagram (build-sequence: Automatic
// Layered Layout). Positions are computed from the display graph every time and are
// never stored.
import dagre from "@dagrejs/dagre";
import type { StepKey } from "./template";
import type { DisplayGraph } from "./variant";

/** Size of a step box, px. */
export const STEP_BOX_WIDTH = 200;
export const STEP_BOX_HEIGHT = 60;
/** Distance between layers, px. */
export const LAYER_GAP = 100;
/** Distance between boxes within a layer, px. */
export const BOX_GAP = 50;

export interface Position {
  /** Left edge, px. */
  x: number;
  /** Top edge, px. */
  y: number;
}

/** Top-left position of every displayed step's box. */
export function layoutDiagram(graph: DisplayGraph): Map<StepKey, Position> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: LAYER_GAP, nodesep: BOX_GAP, marginx: 0, marginy: 0 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const step of graph.steps) {
    g.setNode(step.key, { width: STEP_BOX_WIDTH, height: STEP_BOX_HEIGHT });
  }
  for (const [from, to] of graph.arrows) g.setEdge(from, to);
  dagre.layout(g);

  const positions = new Map<StepKey, Position>();
  for (const step of graph.steps) {
    const node = g.node(step.key) as { x: number; y: number };
    positions.set(step.key, {
      x: node.x - STEP_BOX_WIDTH / 2,
      y: node.y - STEP_BOX_HEIGHT / 2,
    });
  }
  return positions;
}
