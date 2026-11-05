"use client";

import type { StepKey } from "@/lib/sequence/template";
import { useBuild } from "./BuildProvider";
import { StepsChecklist } from "./StepsChecklist";

/** The build's Steps view: the checklist (build-sequence: Steps Checklist). */
export function StepsView({ currentKey }: { currentKey?: StepKey }) {
  const { build, graph, states } = useBuild();
  return (
    <StepsChecklist buildId={build.id} graph={graph} states={states} currentKey={currentKey} />
  );
}
