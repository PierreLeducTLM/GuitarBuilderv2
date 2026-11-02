"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  ReactFlow,
  type Viewport,
} from "@xyflow/react";
import { useTranslations } from "next-intl";
import { type CSSProperties, useMemo, useState } from "react";
import { layoutDiagram } from "@/lib/sequence/layout";
import { type StepStates, stepStatus } from "@/lib/sequence/state";
import type { StepKey } from "@/lib/sequence/template";
import type { DisplayGraph } from "@/lib/sequence/variant";
import { OpenStepContext, StepNode, type StepNodeType } from "./StepNode";
import { loadViewport, saveViewport } from "./viewport";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 1.5;

const nodeTypes = { step: StepNode };

// React Flow's colours, mapped onto the design tokens.
const themeVariables = {
  "--xy-background-color": "var(--gb-inset)",
  "--xy-background-pattern-dots-color": "var(--gb-line-strong)",
  "--xy-edge-stroke": "var(--gb-line-strong)",
  "--xy-edge-stroke-width": "1.5",
  "--xy-controls-button-background-color": "var(--gb-panel)",
  "--xy-controls-button-background-color-hover": "var(--gb-raised)",
  "--xy-controls-button-color": "var(--gb-fg)",
  "--xy-controls-button-color-hover": "var(--gb-fg)",
  "--xy-controls-button-border-color": "var(--gb-line)",
  "--xy-controls-box-shadow": "none",
  "--xy-attribution-background-color": "var(--gb-panel)",
} as CSSProperties;

export interface SequenceDiagramProps {
  buildId: string;
  graph: DisplayGraph;
  states: StepStates;
  onOpenStep: (key: StepKey) => void;
}

/**
 * build-sequence: Sequence Diagram Display, Automatic Layered Layout, Diagram Pan and
 * Zoom, Diagram Viewport Persistence and Diagram Interaction Restrictions. Steps cannot
 * be moved, connected or selected; clicking one only opens its details.
 */
export default function SequenceDiagram({
  buildId,
  graph,
  states,
  onOpenStep,
}: SequenceDiagramProps) {
  const t = useTranslations("sequence");
  const positions = useMemo(() => layoutDiagram(graph), [graph]);
  const [initialViewport] = useState(() => loadViewport(buildId));

  const nodes: StepNodeType[] = useMemo(
    () =>
      graph.steps.map((step) => ({
        id: step.key,
        type: "step",
        position: positions.get(step.key) ?? { x: 0, y: 0 },
        data: {
          stepKey: step.key,
          number: step.number,
          status: stepStatus(graph, states, step.key),
          highlight: step.highlight,
        },
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      })),
    [graph, positions, states],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.arrows.map(([from, to]) => ({
        id: `${from}->${to}`,
        source: from,
        target: to,
        type: "step",
        animated: false,
        selectable: false,
        focusable: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      })),
    [graph],
  );

  return (
    <OpenStepContext.Provider value={onOpenStep}>
      <section
        aria-label={t("diagramLabel")}
        className="h-[min(70dvh,44rem)] min-h-96 overflow-hidden rounded-2xl border border-line"
        style={themeVariables}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          defaultViewport={initialViewport ?? undefined}
          fitView={!initialViewport}
          onMoveEnd={(_, viewport: Viewport) => saveViewport(buildId, viewport)}
          // Without a click handler React Flow lets clicks pass through steps that can
          // be neither dragged nor selected.
          onNodeClick={(_, node) => onOpenStep(node.id as StepKey)}
          zoomOnDoubleClick={false}
          ariaLabelConfig={{
            "controls.ariaLabel": t("controls.label"),
            "controls.zoomIn.ariaLabel": t("controls.zoomIn"),
            "controls.zoomOut.ariaLabel": t("controls.zoomOut"),
            "controls.fitView.ariaLabel": t("controls.fitView"),
            "node.a11yDescription.default": "",
            "node.a11yDescription.keyboardDisabled": "",
            "edge.a11yDescription.default": "",
            "handle.ariaLabel": "",
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </section>
    </OpenStepContext.Provider>
  );
}
