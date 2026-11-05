// Where a part flow's connectors run. Rows have a fixed height; across, positions are
// percentages of the flow's width (an SVG stretched over the rows), so the drawing
// follows the screen width. Steps use the left CONTENT_WIDTH percent; the rest is a
// gutter for connectors that skip a row, so they never pass behind a box.
import type { FlowEdge } from "./flow";

export const ROW_HEIGHT = 64;
export const ROW_GAP = 28;
export const CONTENT_WIDTH = 92;
export const GUTTER_X = 96;

const rowTop = (row: number) => row * (ROW_HEIGHT + ROW_GAP);
const columnX = (column: number, count: number) => ((column + 0.5) / count) * CONTENT_WIDTH;

/** The height of a flow of `rows` rows, in pixels. */
export function flowHeight(rows: number): number {
  return Math.max(0, rows * ROW_HEIGHT + (rows - 1) * ROW_GAP);
}

/** The SVG path of a connector; `widths` is the number of steps in each row. */
export function connectorPath(edge: FlowEdge, widths: readonly number[]): string {
  const x1 = columnX(edge.from.column, widths[edge.from.row] ?? 1);
  const x2 = columnX(edge.to.column, widths[edge.to.row] ?? 1);
  const y1 = rowTop(edge.from.row) + ROW_HEIGHT;
  const y2 = rowTop(edge.to.row);
  const below = y1 + ROW_GAP / 2;
  if (!edge.skips) return `M ${x1} ${y1} V ${below} H ${x2} V ${y2}`;
  return `M ${x1} ${y1} V ${below} H ${GUTTER_X} V ${y2 - ROW_GAP / 2} H ${x2} V ${y2}`;
}
