"use client";

import { cx } from "@gb/ui";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/sequence/state";
import { type StepHighlight, type StepKey, stepNumberLabel } from "@/lib/sequence/template";

export type StepNodeData = {
  stepKey: StepKey;
  number: number;
  status: StepStatus;
  highlight: StepHighlight | null;
};

export type StepNodeType = Node<StepNodeData, "step">;

/** Opens a step's details dialog (the only interaction a step box offers). */
export const OpenStepContext = createContext<(key: StepKey) => void>(() => {});

export { stepNumberLabel };

const statusClasses: Record<StepStatus, string> = {
  completed: "border-teal-line bg-teal-soft",
  ready: "border-amber shadow-glow-amber bg-amber-soft",
  notStarted: "border-line bg-panel",
};

/** A step box: number, label, state look, variant highlight and completion badge. */
export function StepNode({ data }: NodeProps<StepNodeType>) {
  const t = useTranslations();
  const openStep = useContext(OpenStepContext);
  const label = t(`steps.${data.stepKey}`);
  const number = stepNumberLabel(data.number);
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="!opacity-0" />
      <button
        type="button"
        data-step={data.stepKey}
        data-status={data.status}
        data-highlight={data.highlight ?? undefined}
        aria-label={t("sequence.stepName", {
          number,
          label,
          status: t(`sequence.legend.${data.status}`),
        })}
        onClick={() => openStep(data.stepKey)}
        className={cx(
          "nodrag nopan relative flex h-[60px] w-[200px] cursor-pointer flex-col justify-center gap-0.5 overflow-hidden rounded-lg border py-1.5 pr-7 pl-3 text-left transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          statusClasses[data.status],
          data.highlight === "variant" && data.status === "notStarted" && "bg-variant-soft",
          data.highlight === "bridgeBlank" && data.status === "notStarted" && "bg-blank-soft",
        )}
      >
        {data.highlight ? (
          <span
            aria-hidden="true"
            className={cx(
              "absolute inset-y-0 left-0 w-1.5",
              data.highlight === "variant" ? "bg-variant-ink" : "bg-blank-ink",
            )}
          />
        ) : null}
        <span aria-hidden="true" className="font-mono text-2xs font-bold text-fg-dim">
          {number}
        </span>
        <span
          aria-hidden="true"
          className="line-clamp-2 text-[0.8125rem] leading-tight font-medium text-fg"
        >
          {label}
        </span>
        {data.status === "completed" ? (
          <span
            aria-hidden="true"
            data-testid="completion-badge"
            className="absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-teal text-on-teal"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : null}
      </button>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!opacity-0"
      />
    </>
  );
}
